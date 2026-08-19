import { currentAccount, loginAccount, logoutAccount, registerAccount } from "@/lib/auth";

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    return Response.json({ account: await currentAccount(request) });
  } catch {
    return jsonError("暂时无法读取登录状态", 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? "");
    if (action === "register") {
      const result = await registerAccount(request, body);
      return Response.json({ account: result.account }, { headers: { "set-cookie": result.cookie } });
    }
    if (action === "login") {
      const result = await loginAccount(request, body);
      return Response.json({ account: result.account }, { headers: { "set-cookie": result.cookie } });
    }
    if (action === "logout") {
      return Response.json({ account: null }, { headers: { "set-cookie": await logoutAccount(request) } });
    }
    return jsonError("未知的账号操作");
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "账号操作失败");
  }
}
