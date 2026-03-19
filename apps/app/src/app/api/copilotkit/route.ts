import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { LangGraphAgent } from "@copilotkit/runtime/langgraph";
import { MCPAppsMiddleware } from "@ag-ui/mcp-apps-middleware";
import { NextRequest } from "next/server";

// 1. Define the default agent connection to LangGraph
const defaultAgent = new LangGraphAgent({
  deploymentUrl: process.env.LANGGRAPH_DEPLOYMENT_URL || "http://localhost:8123",
  graphId: "sample_agent",
  langsmithApiKey: process.env.LANGSMITH_API_KEY || "",
});

// 2. Wire up MCP apps middleware so widget HTML is sent to the frontend
defaultAgent.use(
  new MCPAppsMiddleware({
    mcpServers: [{
      type: "http",
      url: process.env.MCP_SERVER_URL || "https://mcp.excalidraw.com",
      serverId: "example_mcp_app",
    }],
  })
);

// 3. Define the document agent for the canvas editor
const documentAgent = new LangGraphAgent({
  deploymentUrl: process.env.LANGGRAPH_DEPLOYMENT_URL || "http://localhost:8123",
  graphId: "document_agent",
  langsmithApiKey: process.env.LANGSMITH_API_KEY || "",
});

// Allow long-running agent + MCP tool calls
export const maxDuration = 300;

// 4. Define the route and CopilotRuntime for the agents
export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    endpoint: "/api/copilotkit",
    serviceAdapter: new ExperimentalEmptyAdapter(),
    runtime: new CopilotRuntime({
      agents: {
        default: defaultAgent,
        document_agent: documentAgent,
      },
      a2ui: { injectA2UITool: true },
    }),
  });

  return handleRequest(req);
};
