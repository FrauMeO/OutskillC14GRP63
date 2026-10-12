# Fonts

`bricolage-grotesque-latin-700.woff2` is Bricolage Grotesque Bold (Copyright 2022 The Bricolage Grotesque Project Authors, https://github.com/ateliertriay/bricolage), licensed under the SIL Open Font License 1.1 (https://openfontlicense.org), which allows self-hosting, embedding and subsetting. The npm package `@fontsource-variable/bricolage-grotesque` (OFL-1.1, v5.3.0) ships the same family.

It is a subset of the variable font served by Google Fonts: weight fixed at 700 (every `font-display` heading is bold), optical size fixed at 24, Basic Latin plus curly quotes, dashes and the ellipsis, kerning kept, hinting dropped. About 11 KB. No dependency was added; this is the only font the app loads. Body text uses the device's own font.

To regenerate: take the Latin woff2 from Google Fonts or the fontsource package, pin `opsz=24` and `wght=700` with `fontTools.varLib.instancer`, then subset with `fontTools.subset` (layout feature `kern` only, no hinting) to U+0020-007E, U+00A0, U+2013, U+2014, U+2018, U+2019, U+201C, U+201D, U+2026, flavor woff2.
