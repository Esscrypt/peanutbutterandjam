;(() => {
  var implementors = Object.fromEntries([
    [
      'fixedbitset',
      [
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/fmt/trait.Binary.html" title="trait core::fmt::Binary">Binary</a> for <a class="struct" href="fixedbitset/struct.FixedBitSet.html" title="struct fixedbitset::FixedBitSet">FixedBitSet</a>',
        ],
      ],
    ],
    [
      'napi',
      [
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/fmt/trait.Binary.html" title="trait core::fmt::Binary">Binary</a> for <a class="struct" href="napi/struct.PropertyAttributes.html" title="struct napi::PropertyAttributes">PropertyAttributes</a>',
        ],
      ],
    ],
  ])
  if (window.register_implementors) {
    window.register_implementors(implementors)
  } else {
    window.pending_implementors = implementors
  }
})()
//{"start":57,"fragment_lengths":[287,288]}
