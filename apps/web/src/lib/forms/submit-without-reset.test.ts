import { describe, expect, it, vi } from "vitest";
import { submitWithoutReset } from "./submit-without-reset";

describe("submitWithoutReset", () => {
  it("empêche l'envoi natif et transmet le contenu du formulaire à l'action", () => {
    const data = new FormData();
    data.set("firstName", "Camille");
    const action = vi.fn();
    const preventDefault = vi.fn();
    const form = {} as HTMLFormElement;
    const readForm = vi.fn(() => data);

    submitWithoutReset(action, readForm)({ preventDefault, currentTarget: form });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(readForm).toHaveBeenCalledWith(form);
    expect(action).toHaveBeenCalledWith(data);
  });
});
