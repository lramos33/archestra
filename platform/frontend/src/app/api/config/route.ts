import { client } from "@shared/api-client/client.gen";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    apiBaseUrl: client.getConfig().baseUrl,
  });
}
