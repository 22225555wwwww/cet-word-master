'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const { parsePageParams } = require('../src/pagination');

describe('pagination parsePageParams', () => {
  test('缺省值：page=1, pageSize=50', () => {
    assert.deepStrictEqual(parsePageParams({}), { page: 1, pageSize: 50 });
  });

  test('正常值原样解析', () => {
    assert.deepStrictEqual(parsePageParams({ page: '3', pageSize: '20' }), { page: 3, pageSize: 20 });
  });

  test('pageSize 上限钳制到 200，下限到 1', () => {
    assert.strictEqual(parsePageParams({ pageSize: '500' }).pageSize, 200);
    assert.strictEqual(parsePageParams({ pageSize: '0' }).pageSize, 1);
    assert.strictEqual(parsePageParams({ pageSize: '-5' }).pageSize, 1);
  });

  test('page 下限钳制到 1，小数向下取整', () => {
    assert.strictEqual(parsePageParams({ page: '0' }).page, 1);
    assert.strictEqual(parsePageParams({ page: '-3' }).page, 1);
    assert.strictEqual(parsePageParams({ page: '2.9' }).page, 2);
  });

  test('非数字输入回退默认值', () => {
    assert.deepStrictEqual(parsePageParams({ page: 'abc', pageSize: 'xyz' }), { page: 1, pageSize: 50 });
    assert.deepStrictEqual(parsePageParams({ page: NaN, pageSize: Infinity }), { page: 1, pageSize: 50 });
  });
});
