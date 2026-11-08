import { describe, expect, it } from "vitest";
import { checkBudgetPassword } from "./budgetLock";

describe("checkBudgetPassword", () => {
  it("accepteert het wachtwoord, ook met hoofdletters of spaties eromheen", async () => {
    expect(await checkBudgetPassword("singhaislekker")).toBe(true);
    expect(await checkBudgetPassword(" SinghaIsLekker ")).toBe(true);
  });

  it("weigert een ander wachtwoord", async () => {
    expect(await checkBudgetPassword("lion")).toBe(false);
  });
});
