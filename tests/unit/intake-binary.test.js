import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { fetchBinary, fetchSource } from '../../src/intake.js';

// ---------------------------------------------------------------- 헬퍼

// Node IncomingMessage 최소 모킹 — readCappedBody가 소비하는 이벤트 구현.
function mockResponse(statusCode, chunks = [], { headers = {}, statusMessage = 'OK' } = {}) {
  const emitter = new EventEmitter();
  emitter.statusCode = statusCode;
  emitter.statusMessage = statusMessage;
  emitter.headers = headers;
  // readCappedBody 초과 시 destroy() 호출 → rejection은 rejectPromise가 직접 처리.
  emitter.destroy = () => {};
  emitter.resume = () => {};
  process.nextTick(() => {
    for (const chunk of chunks) {
      emitter.emit('data', Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'utf8'));
    }
    emitter.emit('end');
  });
  return emitter;
}

// 공인 IP를 돌려주는 lookup mock
const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }];

// ---------------------------------------------------------------- assertSafeUrl 공유 증명: 사전검증 (리터럴 IP)

test('fetchBinary: 127.0.0.1 루프백 거부 (assertSafeUrl 공유)', async () => {
  await assert.rejects(
    () => fetchBinary('http://127.0.0.1/logo.png'),
    /private address/,
  );
});

test('fetchBinary: 169.254.169.254 메타데이터 서버 거부', async () => {
  await assert.rejects(
    () => fetchBinary('http://169.254.169.254/latest/meta-data/'),
    /private address/,
  );
});

test('fetchBinary: ::1 IPv6 루프백 거부', async () => {
  await assert.rejects(
    () => fetchBinary('http://[::1]/asset.png'),
    /private address/,
  );
});

test('fetchBinary: ::ffff:10.0.0.1 IPv4-mapped IPv6 거부', async () => {
  await assert.rejects(
    () => fetchBinary('http://[::ffff:10.0.0.1]/asset.png'),
    /private address/,
  );
});

// ---------------------------------------------------------------- assertSafeUrl 공유 증명: DNS 해석 경유 (lookupImpl 주입)

test('fetchBinary: DNS가 private 주소로 해석되면 lookupImpl 주입으로 거부', async () => {
  const evilLookup = async () => [{ address: '10.0.0.7', family: 4 }];
  await assert.rejects(
    () => fetchBinary('http://evil.example.com/logo.png', { lookupImpl: evilLookup }),
    /resolves to private address 10\.0\.0\.7/,
  );
});

test('fetchBinary: DNS가 link-local 169.254.x.x 으로 해석되면 거부', async () => {
  const evilLookup = async () => [{ address: '169.254.100.1', family: 4 }];
  await assert.rejects(
    () => fetchBinary('http://meta.example.com/data.bin', { lookupImpl: evilLookup }),
    /resolves to private address 169\.254\.100\.1/,
  );
});

// ---------------------------------------------------------------- 5MB 본문 캡 (requestImpl 주입)

test('fetchBinary: 5MB 초과 본문은 cap abort (response exceeds)', async () => {
  const BIG = 6 * 1024 * 1024; // 6 MB
  const bigChunk = Buffer.alloc(BIG, 0x41);

  const requestImpl = async () => {
    const emitter = new EventEmitter();
    emitter.statusCode = 200;
    emitter.statusMessage = 'OK';
    emitter.headers = {};
    emitter.destroy = () => {};
    emitter.resume = () => {};
    // 단일 청크로 6MB emit → readCappedBody 내부에서 cap 초과 감지
    process.nextTick(() => emitter.emit('data', bigChunk));
    return emitter;
  };

  await assert.rejects(
    () => fetchBinary('http://big.example.com/huge.bin', { requestImpl, lookupImpl: publicLookup }),
    /response exceeds/,
  );
});

// ---------------------------------------------------------------- 정상 바이너리 반환 (requestImpl 주입)

test('fetchBinary: 정상 응답은 Buffer 반환', async () => {
  const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG 시그니처
  const requestImpl = async () => mockResponse(200, [pngMagic]);

  const result = await fetchBinary('http://cdn.example.com/image.png', { requestImpl, lookupImpl: publicLookup });
  assert.ok(Buffer.isBuffer(result), 'fetchBinary는 Buffer를 반환해야 한다');
  assert.deepEqual(result.slice(0, 8), pngMagic, 'PNG 매직 바이트가 보존돼야 한다');
});

test('fetchBinary: 여러 청크가 올바르게 concat된 Buffer 반환', async () => {
  const chunk1 = Buffer.from([0x01, 0x02]);
  const chunk2 = Buffer.from([0x03, 0x04]);
  const requestImpl = async () => mockResponse(200, [chunk1, chunk2]);

  const result = await fetchBinary('http://cdn.example.com/data.bin', { requestImpl, lookupImpl: publicLookup });
  assert.ok(Buffer.isBuffer(result));
  assert.deepEqual([...result], [0x01, 0x02, 0x03, 0x04]);
});

// ---------------------------------------------------------------- redirect hop 재검증 (requestImpl 주입)

test('fetchBinary: redirect hop 재검증 — private 대상은 요청 전 차단', async () => {
  const requested = [];

  const requestImpl = async (url) => {
    requested.push(url.href);
    assert.ok(!url.href.includes('127.0.0.1'), 'private redirect 대상은 요청되면 안 된다');
    return { statusCode: 302, headers: { location: 'http://127.0.0.1/logo.png' }, resume() {} };
  };

  await assert.rejects(
    () => fetchBinary('http://public.example.com/logo.png', { requestImpl, lookupImpl: publicLookup }),
    /private address/,
  );
  // 원본 URL만 요청, redirect 대상은 assertSafeUrl에서 막혀 requestImpl에 도달 안 함
  assert.deepEqual(requested, ['http://public.example.com/logo.png']);
});

test('fetchBinary: 정상 redirect는 최종 hop 본문을 Buffer로 반환', async () => {
  const finalData = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
  let hop = 0;

  const requestImpl = async (url) => {
    hop += 1;
    if (hop === 1) {
      // 첫 번째 hop: redirect
      return { statusCode: 302, headers: { location: 'http://cdn2.example.com/asset.bin' }, resume() {} };
    }
    // 두 번째 hop: 실제 데이터
    return mockResponse(200, [finalData]);
  };

  const result = await fetchBinary('http://cdn.example.com/asset.bin', { requestImpl, lookupImpl: publicLookup });
  assert.ok(Buffer.isBuffer(result));
  assert.deepEqual([...result], [...finalData]);
  assert.equal(hop, 2, '정확히 2 hop이어야 한다');
});

// ---------------------------------------------------------------- readCappedBody encoding 분기 증명

test('readCappedBody encoding=null: fetchBinary는 Buffer 반환', async () => {
  // 유효하지 않은 UTF-8 바이트를 포함해 string 변환이 아닌 것을 확인
  const binaryData = Buffer.from([0xff, 0xfe, 0x00, 0x01]);
  const requestImpl = async () => mockResponse(200, [binaryData]);

  const result = await fetchBinary('http://cdn.example.com/raw.bin', { requestImpl, lookupImpl: publicLookup });
  assert.ok(Buffer.isBuffer(result), 'encoding=null이면 Buffer');
  assert.deepEqual([...result], [...binaryData], '바이너리 바이트가 변환 없이 보존돼야 한다');
});

test('readCappedBody 기본 encoding utf8: fetchSource는 string 반환', async () => {
  const text = '안녕하세요 world';
  const requestImpl = async () => mockResponse(200, [Buffer.from(text, 'utf8')]);

  const result = await fetchSource('http://cdn.example.com/page.html', { requestImpl, lookupImpl: publicLookup });
  assert.equal(typeof result, 'string', 'fetchSource는 string을 반환해야 한다');
  assert.equal(result, text);
});
