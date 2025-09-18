# Changelog

## [0.0.7](https://github.com/archestra-ai/archestra/compare/v0.0.6...v0.0.7) (2025-09-18)


### Features

* Add archestra-llm provider and llm-proxy service ([#460](https://github.com/archestra-ai/archestra/issues/460)) ([243518c](https://github.com/archestra-ai/archestra/commit/243518ce1ee01b31f17e1e60433ec160b699faed))
* Add stop button and fix bugs in error display ([#461](https://github.com/archestra-ai/archestra/issues/461)) ([4e6a853](https://github.com/archestra-ai/archestra/commit/4e6a85309579916a4ca2a1df6063a8e37c760d8c))


### Bug Fixes

* errors when connecting Slack and GitHub connectors ([#433](https://github.com/archestra-ai/archestra/issues/433)) ([da05c1b](https://github.com/archestra-ai/archestra/commit/da05c1ba9010a37eb7e53278bf503fd577eb366f))

## [0.0.6](https://github.com/archestra-ai/archestra/compare/v0.0.5...v0.0.6) (2025-09-17)


### Bug Fixes

* auto-refresh Ollama models list after download completes ([#455](https://github.com/archestra-ai/archestra/issues/455)) ([02a964c](https://github.com/archestra-ai/archestra/commit/02a964c7f3d225d73309a1fe14b2e215232c19fc))
* hide system messages from chat UI ([#445](https://github.com/archestra-ai/archestra/issues/445)) ([b92205e](https://github.com/archestra-ai/archestra/commit/b92205e4869f851617b3b1bc3c504ef8ec3970c2))
* polishing for archestra mcp ([#447](https://github.com/archestra-ai/archestra/issues/447)) ([7ae602d](https://github.com/archestra-ai/archestra/commit/7ae602d4cdac97b31a3249cbd83601b2a0d33804))
* posthog is back ([#459](https://github.com/archestra-ai/archestra/issues/459)) ([10826bb](https://github.com/archestra-ai/archestra/commit/10826bbe76b7d386fc78965abcf188e15e7ae4f8))
* properly update messages with edited content before saving ([#453](https://github.com/archestra-ai/archestra/issues/453)) ([f2920b6](https://github.com/archestra-ai/archestra/commit/f2920b6b24dbe01a6fd04e7e0ebf4ec8e066ecbb))
* race condition with memory loading on chat reset ([#457](https://github.com/archestra-ai/archestra/issues/457)) ([fc68d6b](https://github.com/archestra-ai/archestra/commit/fc68d6b0f6a0ef804bd909eba987c3556fb65665))
* resolve HTML validation error for nested button elements in sidebar ([#458](https://github.com/archestra-ai/archestra/issues/458)) ([37b2d57](https://github.com/archestra-ai/archestra/commit/37b2d57ef8835362d3a77747fd9dbb6f38667777))
* tweak vercel sdk `providerOptions` ([#434](https://github.com/archestra-ai/archestra/issues/434)) ([64d0100](https://github.com/archestra-ai/archestra/commit/64d01009d708b9c143d86a4354542dca9d0b5620))

## [0.0.5](https://github.com/archestra-ai/archestra/compare/v0.0.4...v0.0.5) (2025-09-17)


### Features

* add context size, fix bugs ([#432](https://github.com/archestra-ai/archestra/issues/432)) ([aa4eb52](https://github.com/archestra-ai/archestra/commit/aa4eb5207ab6efc63bf4e30b079ce7f5c62ed67d))


### Bug Fixes

* infinite tool analysis loading in UI sidebar ([#419](https://github.com/archestra-ai/archestra/issues/419)) ([59a73df](https://github.com/archestra-ai/archestra/commit/59a73df2139c26ed8d2dcdef7251e23f082a8b12)), closes [#404](https://github.com/archestra-ai/archestra/issues/404)
* Logs and sys prompt ([#397](https://github.com/archestra-ai/archestra/issues/397)) ([c56cf5a](https://github.com/archestra-ai/archestra/commit/c56cf5a502307eeff3b3f0ba31abfa20d8a4c4f7))
* open links in external browser instead of internal browser ([#423](https://github.com/archestra-ai/archestra/issues/423)) ([30efde3](https://github.com/archestra-ai/archestra/commit/30efde3797c58d2d45305fc70eae121f697d318b))
* show auth confirmation dialog for Remote MCP servers ([#422](https://github.com/archestra-ai/archestra/issues/422)) ([d56b0ac](https://github.com/archestra-ai/archestra/commit/d56b0acf829e837855e9bc7b2364e9338611b579))
* system prompt and markup ([#416](https://github.com/archestra-ai/archestra/issues/416)) ([a215c3a](https://github.com/archestra-ai/archestra/commit/a215c3acbd43e97fb61b8f16d9cfe94d74a1a7d5))

## [0.0.4](https://github.com/archestra-ai/archestra/compare/v0.0.3...v0.0.4) (2025-09-16)


### Features

* basic packaged-app e2e test ([#341](https://github.com/archestra-ai/archestra/issues/341)) ([640ca39](https://github.com/archestra-ai/archestra/commit/640ca390fc9a31ab626f906f4aab766f3ff7e444))


### Bug Fixes

* address outstanding pnpm typecheck errors ([#395](https://github.com/archestra-ai/archestra/issues/395)) ([726803c](https://github.com/archestra-ai/archestra/commit/726803c8a3810204df8ef132b3af51b6cac23011))
* several chat related bugs ([#394](https://github.com/archestra-ai/archestra/issues/394)) ([90503d1](https://github.com/archestra-ai/archestra/commit/90503d1c32d8b79c6da89839d44ebbf8c06f6976))


### Dependencies

* **frontend:** bump the frontend-dependencies group across 1 directory with 35 updates ([#398](https://github.com/archestra-ai/archestra/issues/398)) ([cbbe509](https://github.com/archestra-ai/archestra/commit/cbbe50941d2a965c80b58751875b101ccb988df4))

## [0.0.3](https://github.com/archestra-ai/archestra/compare/v0.0.2...v0.0.3) (2025-09-16)


### Features

* onboarding, local models preloading and other fixes ([#388](https://github.com/archestra-ai/archestra/issues/388)) ([3f8906b](https://github.com/archestra-ai/archestra/commit/3f8906b550d80079ee769ebf0295a2ec21e826f3))


### Bug Fixes

* `vfkit exited unexpectedly with exit code 1` on Mac signed app ([#390](https://github.com/archestra-ai/archestra/issues/390)) ([d21151e](https://github.com/archestra-ai/archestra/commit/d21151e3460198a691f7101beabebfc8cdf1b5bc))

## [0.0.2](https://github.com/archestra-ai/archestra/compare/v0.0.1...v0.0.2) (2025-09-15)


### Bug Fixes

* test to trigger new version (testing auto-updater functionality) ([e065df8](https://github.com/archestra-ai/archestra/commit/e065df8b4106f39250e70017f39ee25caa015d56))

## 0.0.1 (2025-09-15)


### Features

* Hello World, Meet Archestra 🤖❤️ ([9586698](https://github.com/archestra-ai/archestra/commit/95866981b0fc62bd84fba9b87336573b4cdbfa35))
