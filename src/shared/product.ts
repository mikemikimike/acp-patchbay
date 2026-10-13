// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Solutions Unity

// How patchbay names itself to every peer it speaks to: the agents it
// initializes, the MCP servers it checks, the agents reading its own server,
// the OAuth servers it registers with. One name and one version, the
// extension's own, folded in from its manifest at build. Everything that
// names itself ships inside the extension, so no part keeps a version of
// its own.
import { name, version } from "../../package.json";

export const PRODUCT = { name, version } as const;
