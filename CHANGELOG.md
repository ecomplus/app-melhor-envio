# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [1.6.1](https://github.com/ecomclub/app-melhor-envio/compare/v1.6.0...v1.6.1) (2023-04-04)


### Bug Fixes

* **calculate:** set zero to discount higher than total price ([e52970e](https://github.com/ecomclub/app-melhor-envio/commit/e52970ed9ee207467382f29ca815c389c9eb6c14))

## [1.6.0](https://github.com/ecomclub/app-melhor-envio/compare/v1.5.9...v1.6.0) (2022-12-20)


### Features

* New "hidden" `skip_no_weight_item` config option ([bc08c47](https://github.com/ecomclub/app-melhor-envio/commit/bc08c47057bd72ff2778ae460298128932081de0))

### [1.5.9](https://github.com/ecomclub/app-melhor-envio/compare/v1.5.8...v1.5.9) (2021-10-21)


### Bug Fixes

* **deps:** update @ecomplus/application-sdk to v1.15.5 sqlite ([42e110f](https://github.com/ecomclub/app-melhor-envio/commit/42e110f70628cdfd4520621f443cced14fc3885f))

### [1.5.8](https://github.com/ecomclub/app-melhor-envio/compare/v1.5.7...v1.5.8) (2021-07-16)


### Bug Fixes

* **calculate:** save package with correct unit ([#59](https://github.com/ecomclub/app-melhor-envio/issues/59)) ([926e35a](https://github.com/ecomclub/app-melhor-envio/commit/926e35a605efc104ac89f6fd9d8225e9006a2f5a))

### [1.5.7](https://github.com/ecomclub/app-melhor-envio/compare/v1.5.6...v1.5.7) (2021-06-17)


### Bug Fixes

* **admin-settngs:** remove (buggy) `sandbox` field ([#58](https://github.com/ecomclub/app-melhor-envio/issues/58)) ([8b19fba](https://github.com/ecomclub/app-melhor-envio/commit/8b19fbab2a77fe98f830cf294e99d58e250e0fe6))

### [1.5.6](https://github.com/ecomclub/app-melhor-envio/compare/v1.5.5...v1.5.6) (2021-04-27)


### Bug Fixes

* **deps:** update all non-major ([a27985c](https://github.com/ecomclub/app-melhor-envio/commit/a27985c57bbc9718844139bebb315214fea7c2c7))
* **tracking:** schedule clear old labels ([1cc8502](https://github.com/ecomclub/app-melhor-envio/commit/1cc85027ba9a47b738ff5f59d083e5e200b47486))

### [1.5.5](https://github.com/ecomclub/app-melhor-envio/compare/v1.5.4...v1.5.5) (2021-01-07)


### Bug Fixes

* **new-lable:** invalid property `invoices` ([#50](https://github.com/ecomclub/app-melhor-envio/issues/50)) ([b20616c](https://github.com/ecomclub/app-melhor-envio/commit/b20616c373f0ea3823f43b45fa8a398e9c2c0c23))

### [1.5.4](https://github.com/ecomclub/app-melhor-envio/compare/v1.5.3...v1.5.4) (2021-01-05)

### [1.5.3](https://github.com/ecomclub/app-melhor-envio/compare/v1.5.2...v1.5.3) (2021-01-05)


### Bug Fixes

* **check-valid-order:** must check invoice number only (not issuer) ([cb58ac0](https://github.com/ecomclub/app-melhor-envio/commit/cb58ac094b1acb91cd54034875712e903522f3da))

### [1.5.2](https://github.com/ecomclub/app-melhor-envio/compare/v1.5.1...v1.5.2) (2020-11-26)

### [1.5.1](https://github.com/ecomclub/app-melhor-envio/compare/v1.5.0...v1.5.1) (2020-11-13)


### Bug Fixes

* avoiding errors with .some() when custom_fields is undefined ([339b2e9](https://github.com/ecomclub/app-melhor-envio/commit/339b2e933d6d4502c459afe54fca5baedcc8a099))

## [1.5.0](https://github.com/ecomclub/app-melhor-envio/compare/v1.1.25...v1.5.0) (2020-11-12)


### Features

* **admin-settings:** add 'disable_tracking' boolean option ([7e146b6](https://github.com/ecomclub/app-melhor-envio/commit/7e146b6610834550fbe2f67e7df6db7225ce2ed4))
* **admin-settings:** add/handle new 'enabled_label_checkout' boolean option ([19eef3e](https://github.com/ecomclub/app-melhor-envio/commit/19eef3e40fcbda62dec69a08d5cc4b08fb6fb448))
* **tracking-codes:** try to get code from checkout reponse and save to order data ([#45](https://github.com/ecomclub/app-melhor-envio/issues/45)) ([8b0eedc](https://github.com/ecomclub/app-melhor-envio/commit/8b0eedccbdf154aa9a53d457883408c7bd85cc11))


### Bug Fixes

* **#46:** buy labels when there have been changes in fulfillments instead of fulfillment_status ([924485a](https://github.com/ecomclub/app-melhor-envio/commit/924485a2d57ef4024a83613411c960ef2c400931)), closes [#46](https://github.com/ecomclub/app-melhor-envio/issues/46)
* **database:** no conditions or order to get all sync labels for tracking ([97ec9f1](https://github.com/ecomclub/app-melhor-envio/commit/97ec9f1b4c798f9c7cb07c1632723efee93a6450))
* **tracking:** set delivered if tracking code available only ([5f39057](https://github.com/ecomclub/app-melhor-envio/commit/5f39057c76ebc01561b2eb3247e9dcb54b0a48c9))
* **tracking-codes:** fix handling respective shipping line and prevent wrong status update ([ceac46c](https://github.com/ecomclub/app-melhor-envio/commit/ceac46c3dd50909e88325d59c69a990b75e38b2a))
* **tracking-codes:** fix saving tracking codes to order from schedules tracking job ([#45](https://github.com/ecomclub/app-melhor-envio/issues/45)) ([d0abaed](https://github.com/ecomclub/app-melhor-envio/commit/d0abaedbabf8a7990309c682761c2de01742f8aa))
* **tracking-codes:** fix scheduled tracking post job handlers ([798c2e4](https://github.com/ecomclub/app-melhor-envio/commit/798c2e40d075153d2b856440efe21a2ad9dd04c5))
* **tracking-codes:** running job each 2h, update tracking codes first than status ([448f9ac](https://github.com/ecomclub/app-melhor-envio/commit/448f9aca5c010828425263b7aef9790b5b858db7))
* **webhooks:** ensure label is not duplicated for same order id ([c9a5dbc](https://github.com/ecomclub/app-melhor-envio/commit/c9a5dbcd082759d4f1913c34ce3fc008406f0c36))
* **webhooks:** prevent resending response ([1bad5f9](https://github.com/ecomclub/app-melhor-envio/commit/1bad5f97b752c60cdabc156613ba18c410cf1c5c))

### [1.4.1](https://github.com/ecomclub/app-melhor-envio/compare/v1.4.0...v1.4.1) (2020-10-16)


### Bug Fixes

* **tracking:** set delivered if tracking code available only ([5f39057](https://github.com/ecomclub/app-melhor-envio/commit/5f39057c76ebc01561b2eb3247e9dcb54b0a48c9))
* **webhooks:** prevent resending response ([1bad5f9](https://github.com/ecomclub/app-melhor-envio/commit/1bad5f97b752c60cdabc156613ba18c410cf1c5c))

## [1.4.0](https://github.com/ecomclub/app-melhor-envio/compare/v1.3.0...v1.4.0) (2020-10-16)


### Features

* **admin-settings:** add 'disable_tracking' boolean option ([7e146b6](https://github.com/ecomclub/app-melhor-envio/commit/7e146b6610834550fbe2f67e7df6db7225ce2ed4))

## [1.3.0](https://github.com/ecomclub/app-melhor-envio/compare/v1.2.4...v1.3.0) (2020-10-16)


### Features

* **admin-settings:** add/handle new 'enabled_label_checkout' boolean option ([19eef3e](https://github.com/ecomclub/app-melhor-envio/commit/19eef3e40fcbda62dec69a08d5cc4b08fb6fb448))

### [1.2.4](https://github.com/ecomclub/app-melhor-envio/compare/v1.2.3...v1.2.4) (2020-10-16)


### Bug Fixes

* **tracking-codes:** fix handling respective shipping line and prevent wrong status update ([ceac46c](https://github.com/ecomclub/app-melhor-envio/commit/ceac46c3dd50909e88325d59c69a990b75e38b2a))
* **webhooks:** ensure label is not duplicated for same order id ([c9a5dbc](https://github.com/ecomclub/app-melhor-envio/commit/c9a5dbcd082759d4f1913c34ce3fc008406f0c36))

### [1.2.3](https://github.com/ecomclub/app-melhor-envio/compare/v1.2.2...v1.2.3) (2020-10-14)


### Bug Fixes

* **database:** no conditions or order to get all sync labels for tracking ([97ec9f1](https://github.com/ecomclub/app-melhor-envio/commit/97ec9f1b4c798f9c7cb07c1632723efee93a6450))

### [1.2.2](https://github.com/ecomclub/app-melhor-envio/compare/v1.2.1...v1.2.2) (2020-10-14)


### Bug Fixes

* **tracking-codes:** running job each 2h, update tracking codes first than status ([448f9ac](https://github.com/ecomclub/app-melhor-envio/commit/448f9aca5c010828425263b7aef9790b5b858db7))

### [1.2.1](https://github.com/ecomclub/app-melhor-envio/compare/v1.2.0...v1.2.1) (2020-10-14)


### Bug Fixes

* **tracking-codes:** fix saving tracking codes to order from schedules tracking job ([#45](https://github.com/ecomclub/app-melhor-envio/issues/45)) ([d0abaed](https://github.com/ecomclub/app-melhor-envio/commit/d0abaedbabf8a7990309c682761c2de01742f8aa))

## [1.2.0](https://github.com/ecomclub/app-melhor-envio/compare/v1.1.25...v1.2.0) (2020-10-14)


### Features

* **tracking-codes:** try to get code from checkout reponse and save to order data ([#45](https://github.com/ecomclub/app-melhor-envio/issues/45)) ([8b0eedc](https://github.com/ecomclub/app-melhor-envio/commit/8b0eedccbdf154aa9a53d457883408c7bd85cc11))


### Bug Fixes

* **tracking-codes:** fix scheduled tracking post job handlers ([798c2e4](https://github.com/ecomclub/app-melhor-envio/commit/798c2e40d075153d2b856440efe21a2ad9dd04c5))

### [1.1.25](https://github.com/ecomclub/app-melhor-envio/compare/v1.1.24...v1.1.25) (2020-10-02)

### [1.1.24](https://github.com/ecomclub/app-melhor-envio/compare/v1.1.23...v1.1.24) (2020-10-02)

### [1.1.23](https://github.com/ecomclub/app-melhor-envio/compare/v1.1.22...v1.1.23) (2020-09-19)


### Bug Fixes

* **calculate:** properly handling ME error responses ([dc759d0](https://github.com/ecomclub/app-melhor-envio/commit/dc759d07d0f2b7770e4fcb465c94a9d2d5557a01))
* **procedures:** watch `fulfillment_status` field, not `fulfillments` ([#44](https://github.com/ecomclub/app-melhor-envio/issues/44)) ([dfc9364](https://github.com/ecomclub/app-melhor-envio/commit/dfc936495778d236007143a633c60325386127f5))
* **webhooks:** properlly handle known ME/merchant errors ([6a9da30](https://github.com/ecomclub/app-melhor-envio/commit/6a9da301447bc607500123b1bd47ce9e6f9e6ba5))

### [1.1.22](https://github.com/ecomclub/app-melhor-envio/compare/v1.1.21...v1.1.22) (2020-09-17)


### Bug Fixes

* **new-label:** fix setting me label from (in place of `merchantData`) ([93aa0b3](https://github.com/ecomclub/app-melhor-envio/commit/93aa0b3aa213cc66a495e789733783ddf977c458))

### [1.1.21](https://github.com/ecomclub/app-melhor-envio/compare/v1.1.20...v1.1.21) (2020-09-17)


### Bug Fixes

* **database:** remove limit from delete query ([b3730fb](https://github.com/ecomclub/app-melhor-envio/commit/b3730fbbc1743f99331854013a47a56185e09d2b))

### [1.1.20](https://github.com/ecomclub/app-melhor-envio/compare/v1.1.19...v1.1.20) (2020-09-17)


### Bug Fixes

* **tracking-codes:** properly handle api errors ([566fb58](https://github.com/ecomclub/app-melhor-envio/commit/566fb5811814ed4c98d3dda340057441f0b11e22))

### [1.1.19](https://github.com/ecomclub/app-melhor-envio/compare/v1.1.18...v1.1.19) (2020-09-17)


### Bug Fixes

* **api-requests:** fix store api requests endpoints ([c546919](https://github.com/ecomclub/app-melhor-envio/commit/c546919ce5bb1e443ef4eaeb58e5b1e68054745f))
* **calculate-shipping:** fix checking zip range for free shipping ([e99cead](https://github.com/ecomclub/app-melhor-envio/commit/e99cead52ef1324087b98ae756c47dfe58a362d9))
* **deps:** using @ecomplus/application-sdk sqlite version ([39c7a54](https://github.com/ecomclub/app-melhor-envio/commit/39c7a548a9a78673bf1b8886ef502bd925e7f12d))
* **new-label:** handling legal person doc number ([#42](https://github.com/ecomclub/app-melhor-envio/issues/42)) ([454cbc7](https://github.com/ecomclub/app-melhor-envio/commit/454cbc71e385e365977fd269d7d2184547d89f82))
* **new-label:** preventing fatal erros with undefined properties ([d680927](https://github.com/ecomclub/app-melhor-envio/commit/d680927a6df707d0d3527407e7052bd12ca2687c))

### [1.1.18](https://github.com/ecomclub/app-melhor-envio/compare/v1.1.17...v1.1.18) (2020-09-10)

### [1.1.17](https://github.com/ecomclub/app-melhor-envio/compare/v1.1.16...v1.1.17) (2020-09-10)

### [1.1.16](https://github.com/ecomclub/app-melhor-envio/compare/v1.1.15...v1.1.16) (2020-09-10)

### [1.1.15](https://github.com/ecomclub/app-melhor-envio/compare/v1.1.14...v1.1.15) (2020-09-09)

### [1.1.14](https://github.com/ecomclub/app-melhor-envio/compare/v1.1.13...v1.1.14) (2020-08-24)

### [1.1.13](https://github.com/ecomclub/app-melhor-envio/compare/v1.1.12...v1.1.13) (2020-07-20)

### [1.1.12](https://github.com/ecomclub/app-melhor-envio/compare/v1.1.11...v1.1.12) (2020-07-20)


### Bug Fixes

* **tracking-codes.js:** ignored orders without labels purshed ([4bf2fd1](https://github.com/ecomclub/app-melhor-envio/commit/4bf2fd138060962c1179b5dbdc58e979feae5d68))

### [1.1.11](https://github.com/ecomclub/app-melhor-envio/compare/v1.1.10...v1.1.11) (2020-07-20)


### Bug Fixes

* **local:** register procedures correctly ([ab6b3f1](https://github.com/ecomclub/app-melhor-envio/commit/ab6b3f15b0a290e228dbacb700f0f57f807f1a7f))

### [1.1.10](https://github.com/ecomclub/app-melhor-envio/compare/v1.1.9...v1.1.10) (2020-07-16)

### [1.1.9](https://github.com/ecomclub/app-melhor-envio/compare/v1.1.8...v1.1.9) (2020-07-09)


### Bug Fixes

* **new-label:** package dimensions ([1074af3](https://github.com/ecomclub/app-melhor-envio/commit/1074af3d124514642284e6d50a8cda9b8077b52a))

### [1.1.8](https://github.com/ecomclub/app-melhor-envio/compare/v1.1.7...v1.1.8) (2020-07-09)


### Bug Fixes

* **new-label:** package values ([39a8a40](https://github.com/ecomclub/app-melhor-envio/commit/39a8a40f4605d81fdf4061baca00ced23435e5b5))
* **webhook:** save error in order hidden_metafield ([977bf24](https://github.com/ecomclub/app-melhor-envio/commit/977bf2491113f352d72edf20e4df6aecf3e6bb61))

### [1.1.7](https://github.com/ecomclub/app-melhor-envio/compare/v1.1.6...v1.1.7) (2020-07-09)


### Bug Fixes

* **client:** baseURL when is not sandbox ([7917d9b](https://github.com/ecomclub/app-melhor-envio/commit/7917d9b97e53503e7841be247c2181ecd0cd13c7))

### [1.1.6](https://github.com/ecomclub/app-melhor-envio/compare/v1.1.5...v1.1.6) (2020-07-03)


### Bug Fixes

* preventing errors shipping_rules without service_name ([99d39fd](https://github.com/ecomclub/app-melhor-envio/commit/99d39fd6e8d665cf95d288c916c599a4b2ca0c96))
* **client:** sandbox mode ([02f207f](https://github.com/ecomclub/app-melhor-envio/commit/02f207f32dbc52b32ed8d957493501143ef6a346))

### [1.1.5](https://github.com/ecomclub/app-melhor-envio/compare/v1.1.4...v1.1.5) (2020-07-03)


### Bug Fixes

* json sintaxe ([92c6b13](https://github.com/ecomclub/app-melhor-envio/commit/92c6b136add346e9eac82cb691ca2c2cdb77ce51))
* **calculate:** validate zip code for free_shipping_from_value [#37](https://github.com/ecomclub/app-melhor-envio/issues/37) ([de6c531](https://github.com/ecomclub/app-melhor-envio/commit/de6c5310ced0187202162cf8db6d29f3668366c5))

### [1.1.4](https://github.com/ecomclub/app-melhor-envio/compare/v1.1.2...v1.1.4) (2020-05-07)


### Bug Fixes

* **calculate:** discount applies for the service name instead of the service code ([03c9e5b](https://github.com/ecomclub/app-melhor-envio/commit/03c9e5bf413145cbaaa5aaa1b409da2e7c8f0b03))
* **calculate:** fix mathcing shipping rules by service ([a5b1849](https://github.com/ecomclub/app-melhor-envio/commit/a5b1849bee3dbdf8e4f3f49e03a0188e4d9e53de))

### [1.1.3](https://github.com/ecomclub/app-melhor-envio/compare/v1.1.2...v1.1.3) (2020-05-07)


### Bug Fixes

* **calculate:** fix mathcing shipping rules by service ([a5b1849](https://github.com/ecomclub/app-melhor-envio/commit/a5b1849bee3dbdf8e4f3f49e03a0188e4d9e53de))

### [1.1.2](https://github.com/ecomclub/app-melhor-envio/compare/v1.1.1...v1.1.2) (2020-05-07)


### Bug Fixes

* checks property before turning in uppercase ([0fc1e46](https://github.com/ecomclub/app-melhor-envio/commit/0fc1e4693468574239ea140d3224118e1c5a4a45))

### [1.1.1](https://github.com/ecomclub/app-melhor-envio/compare/v1.1.0...v1.1.1) (2020-05-06)

## [1.1.0](https://github.com/ecomclub/app-melhor-envio/compare/v0.2.7...v1.1.0) (2020-05-06)


### Features

* editable service label ([#35](https://github.com/ecomclub/app-melhor-envio/issues/35)) ([d09dc98](https://github.com/ecomclub/app-melhor-envio/commit/d09dc98d341e929132f6eb748931cfbc8a3876ea))


### Bug Fixes

* market:publish script ([6d85629](https://github.com/ecomclub/app-melhor-envio/commit/6d856291c8c789994ca17e27f1de049787a59910))
