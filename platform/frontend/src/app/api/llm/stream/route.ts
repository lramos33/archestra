import { client } from "@shared/api-client/client.gen";
import type { NextRequest } from "next/server";

/**
 * POST /api/llm/stream
 * Proxy streaming requests to the backend Fastify server
 *
 * This endpoint receives streaming requests from the frontend
 * and proxies them to the backend, maintaining the streaming response.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Get backend base URL from the shared client
    const backendUrl = client.getConfig().baseUrl;

    // Forward the request to the backend
    const response = await fetch(`${backendUrl}/api/llm/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      return new Response(JSON.stringify(error), {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Stream the response back to the frontend
    // The AI SDK streaming format will be preserved
    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "text/plain",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return new Response(
      JSON.stringify({
        error: {
          message: error instanceof Error ? error.message : "Proxy error",
          type: "proxy_error",
        },
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
