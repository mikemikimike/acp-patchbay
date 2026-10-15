// Runs in every test file: ends what each test, and each file, registered
// through test/support/teardown.ts.
import { afterAll, afterEach } from "vitest";
import { drain } from "../support/teardown";

afterEach(() => drain("test"));
afterAll(() => drain("file"));
