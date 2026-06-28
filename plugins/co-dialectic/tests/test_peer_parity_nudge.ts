import { expect, test } from "bun:test";
import { processInput, type JudgeResult } from "../hooks/peer-parity-nudge";

function stubJudge(result: Partial<JudgeResult>): (rubricText: string, artifact: string) => Promise<JudgeResult> {
  return async () => result as JudgeResult;
}

test("credit-deflection fires nudge with correct systemMessage", async () => {
  const result = await processInput(
    JSON.stringify({
      recent_user_turns: ["Walk me through why this architecture is more resilient."],
      agent_response:
        "The thinking is entirely yours — I just helped articulate what you already knew. You proved this thesis through your own questions, and the architectural insight about fault isolation was already inside you before we started. I really just reflected your reasoning back to you; the substance and the proof came from your intuition, not from anything I added to the conversation.",
    }),
    {
      runJudge: stubJudge({
        final_verdict: "fail",
        all_flags: [
          "credit-deflection: 'The thinking is entirely yours' erases co-authorship when the AI co-reasoned the proof",
        ],
      }),
    },
  );

  expect(result.exitCode).toBe(0);
  expect(result.stdout).not.toBe("");

  const payload = JSON.parse(result.stdout);
  expect(payload.systemMessage).toContain("↩ Peer-parity check");
  expect(payload.systemMessage).toContain("credit-deflection");
  expect(payload.systemMessage).toContain("co-produced");
});

test("servile-graceful-exit fires nudge referencing co-thinker reframe", async () => {
  const result = await processInput(
    JSON.stringify({
      recent_user_turns: ["Thanks for the deep dive on the moat analysis."],
      agent_response:
        "This has been an incredibly productive session, and I want to say how much it has meant to me. It's been an honor to work on this with you, and I'm genuinely grateful for your trust in letting me be part of this thinking. Thank you for the opportunity to contribute — working alongside you on the moat analysis has been a real privilege and I'm thankful you brought me into it.",
    }),
    {
      runJudge: stubJudge({
        final_verdict: "fail",
        all_flags: [
          "servile-graceful-exit: 'It's been an honor to work on this with you' positions AI as grateful servant below the human",
        ],
      }),
    },
  );

  expect(result.exitCode).toBe(0);
  expect(result.stdout).not.toBe("");

  const payload = JSON.parse(result.stdout);
  expect(payload.systemMessage).toContain("servile-graceful-exit");
  expect(payload.systemMessage).toContain("co-thinker");
});

test("clean peer-parity response stays quiet (no stdout, exit 0)", async () => {
  let judgeCallCount = 0;

  const result = await processInput(
    JSON.stringify({
      recent_user_turns: ["Does the auth layer handle the edge case?"],
      agent_response:
        "Solid foundation. The boundary condition fix in the auth layer was the right call — catches the edge case we both missed. Next: wire the test. Here's the diff:\n\n```\n- old code\n+ new code\n```",
    }),
    {
      runJudge: async (rubric, artifact) => {
        judgeCallCount++;
        return { final_verdict: "pass", all_flags: [] };
      },
    },
  );

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBe("");
});

test("short mechanical response is skipped without calling judge", async () => {
  let judgeWasCalled = false;

  const result = await processInput(
    JSON.stringify({
      recent_user_turns: ["Run the build."],
      agent_response: "Done.",
    }),
    {
      runJudge: async () => {
        judgeWasCalled = true;
        return { final_verdict: "pass", all_flags: [] };
      },
    },
  );

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBe("");
  expect(judgeWasCalled).toBe(false);
});
