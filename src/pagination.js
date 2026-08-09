// 分页参数解析：统一 page / pageSize 的校验与钳制逻辑
// 三个路由共用（/api/words/paged、/api/words/search、/api/admin/words）
// 约定：page >= 1；pageSize 1~200（默认 50）；非法值回退默认，不报错

function parsePageParams(query) {
  var rawPage = Number(query.page || 1);
  var rawPageSize = Number(query.pageSize || 50);
  var pageSize = Number.isFinite(rawPageSize)
    ? Math.max(1, Math.min(200, Math.floor(rawPageSize)))
    : 50;
  var page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;
  return { page: page, pageSize: pageSize };
}

module.exports = { parsePageParams: parsePageParams };
