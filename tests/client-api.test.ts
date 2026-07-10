import assert from "node:assert/strict";
import test from "node:test";
import * as clientApi from "../app/lib/client-api.ts";

test("turns an empty server response into an actionable API error", async () => {
  assert.equal(typeof clientApi.readJsonResponse, "function");
  await assert.rejects(
    () => clientApi.readJsonResponse(new Response("", { status: 500 })),
    (error: unknown) => {
      assert.equal(error instanceof clientApi.ApiError, true);
      assert.equal((error as clientApi.ApiError).status, 500);
      assert.equal((error as Error).message, "服务暂时没有返回内容，请稍后重试");
      return true;
    },
  );
});
