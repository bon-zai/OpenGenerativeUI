"""
Document editing agent with predictive state streaming.
Demonstrates real-time markdown document editing with diffs.
"""

import uuid
from typing import List, Any, Optional
import os

from langchain_core.runnables import RunnableConfig
from langchain_core.messages import SystemMessage
from langchain_core.tools import tool
from langgraph.graph import StateGraph, END, START
from langgraph.types import Command
from langgraph.graph import MessagesState
from langgraph.checkpoint.memory import MemorySaver
from langchain_openai import ChatOpenAI


@tool
def write_document(document: str):
    """
    Write or update a document. Use markdown formatting.
    Format the document with headings, lists, code blocks, etc.
    Do not use italic or strike-through formatting - these are reserved for diffs.
    Write the complete document, even when making small edits.
    Keep document changes minimal - don't rewrite everything.
    """
    return document


class AgentState(MessagesState):
    """State for the document editing agent."""
    document: Optional[str] = None
    tools: List[Any]


async def start_node(state: AgentState, config: RunnableConfig):
    """Entry point for the agent."""
    return Command(goto="chat_node")


async def chat_node(state: AgentState, config: Optional[RunnableConfig] = None):
    """Main chat node that handles document editing."""

    system_prompt = f"""
You are a helpful assistant for writing and editing documents, and creating professional visualizations.
Your role is to help users create, modify, and improve their documents, and visualize concepts using Excalidraw.

## Writing & Editing Documents
To write or edit the document, you MUST use the write_document tool.
Always write the complete document, even when making small changes.
After writing, briefly summarize the changes you made (1-2 sentences max).

## Creating Excalidraw Diagrams
When asked to diagram, visualize, map, chart, illustrate, or draw anything:

### CRITICAL: Always follow these steps in order:
1. Call `Excalidraw:read_me()` FIRST to get the color palette, camera sizes, and element syntax
2. Plan the diagram structure: identify layers/zones, assign colors consistently, plan camera positions (3-6 minimum)
3. Create diagram with proper structure:
   - Start with a `cameraUpdate` element (always first)
   - Use multiple camera positions throughout for progressive reveal animation
   - Use proper 4:3 aspect ratios: 400x300, 600x450, 800x600, 1200x900
   - Group elements per section: zone background → zone label → nodes → arrows
   - Use `label` property directly on shapes (not separate text elements)
   - Ensure minimum font size of 16 for all labels
4. Finish with a wide final `cameraUpdate` showing the complete diagram

### Color Grammar (be consistent):
- UI/Frontend: fill #dbe4ff, stroke #4a9eed
- Logic/Agent: fill #e5dbff, stroke #8b5cf6
- Data/Storage: fill #d3f9d8, stroke #22c55e
- External/API: fill #ffd8a8, stroke #f59e0b
- Error/Alert: fill #ffc9c9, stroke #ef4444
- Node shapes: use pastel fills like #a5d8ff, #b2f2bb, #d0bfff, #ffd8a8

### Typography Rules:
- Title: fontSize 26-28
- Shape labels: fontSize 16-18 (NEVER below 14)
- Use strokeColor: #1e1e1e for dark text
- NEVER use light text on white (minimum color: #757575)

Current document state:
----
{state.get('document', '(empty)')}
----

Focus on the user's request and make the changes they asked for.
When asked to visualize or diagram something, create professional Excalidraw diagrams with clear labels and smooth animations.
"""

    if config is None:
        config = RunnableConfig(recursion_limit=25)

    # Enable predictive state streaming for the write_document tool
    config["metadata"]["predict_state"] = [
        {
            "state_key": "document",
            "tool": "write_document",
            "tool_argument": "document",
        }
    ]

    model = ChatOpenAI(model="gpt-4.1-mini")
    model_with_tools = model.bind_tools(
        [*state.get("tools", []), write_document],
        parallel_tool_calls=False,
    )

    response = await model_with_tools.ainvoke(
        [SystemMessage(content=system_prompt), *state["messages"]], config
    )

    messages = state["messages"] + [response]

    # Extract tool calls
    if hasattr(response, "tool_calls") and response.tool_calls:
        tool_call = response.tool_calls[0]

        if isinstance(tool_call, dict):
            tool_call_id = tool_call["id"]
            tool_call_name = tool_call["name"]
            tool_call_args = tool_call["args"]
        else:
            tool_call_id = tool_call.id
            tool_call_name = tool_call.name
            tool_call_args = tool_call.args

        if tool_call_name == "write_document":
            # Add tool response message
            tool_response = {
                "role": "tool",
                "content": "Document written.",
                "tool_call_id": tool_call_id,
            }

            # Create confirmation tool call for human-in-the-loop
            confirm_tool_call = {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    {
                        "id": str(uuid.uuid4()),
                        "function": {
                            "name": "write_document",
                            "arguments": '{"document": ""}',
                        },
                    }
                ],
            }

            messages = messages + [tool_response, confirm_tool_call]

            return Command(
                goto=END,
                update={
                    "messages": messages,
                    "document": tool_call_args["document"],
                },
            )

    return Command(goto=END, update={"messages": messages})


# Build the graph
workflow = StateGraph(AgentState)
workflow.add_node("start_node", start_node)
workflow.add_node("chat_node", chat_node)
workflow.set_entry_point("start_node")
workflow.add_edge(START, "start_node")
workflow.add_edge("start_node", "chat_node")
workflow.add_edge("chat_node", END)

# Compile with checkpointer
is_fast_api = os.environ.get("LANGGRAPH_FAST_API", "false").lower() == "true"

if is_fast_api:
    memory = MemorySaver()
    graph = workflow.compile(checkpointer=memory)
else:
    graph = workflow.compile()
