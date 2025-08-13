;(() => {
  var implementors = Object.fromEntries([
    [
      'fixedbitset',
      [
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/iter/traits/collect/trait.FromIterator.html" title="trait core::iter::traits::collect::FromIterator">FromIterator</a>&lt;<a class="primitive" href="https://doc.rust-lang.org/nightly/std/primitive.usize.html">usize</a>&gt; for <a class="struct" href="fixedbitset/struct.FixedBitSet.html" title="struct fixedbitset::FixedBitSet">FixedBitSet</a>',
        ],
      ],
    ],
    [
      'napi',
      [
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/iter/traits/collect/trait.FromIterator.html" title="trait core::iter::traits::collect::FromIterator">FromIterator</a>&lt;<a class="struct" href="napi/struct.PropertyAttributes.html" title="struct napi::PropertyAttributes">PropertyAttributes</a>&gt; for <a class="struct" href="napi/struct.PropertyAttributes.html" title="struct napi::PropertyAttributes">PropertyAttributes</a>',
        ],
      ],
    ],
    [
      'proc_macro2',
      [
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/iter/traits/collect/trait.FromIterator.html" title="trait core::iter::traits::collect::FromIterator">FromIterator</a>&lt;<a class="enum" href="proc_macro2/enum.TokenTree.html" title="enum proc_macro2::TokenTree">TokenTree</a>&gt; for <a class="struct" href="proc_macro2/struct.TokenStream.html" title="struct proc_macro2::TokenStream">TokenStream</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/iter/traits/collect/trait.FromIterator.html" title="trait core::iter::traits::collect::FromIterator">FromIterator</a>&lt;<a class="struct" href="proc_macro2/struct.TokenStream.html" title="struct proc_macro2::TokenStream">TokenStream</a>&gt; for <a class="struct" href="proc_macro2/struct.TokenStream.html" title="struct proc_macro2::TokenStream">TokenStream</a>',
        ],
      ],
    ],
    [
      'regex_syntax',
      [
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/iter/traits/collect/trait.FromIterator.html" title="trait core::iter::traits::collect::FromIterator">FromIterator</a>&lt;<a class="struct" href="regex_syntax/hir/literal/struct.Literal.html" title="struct regex_syntax::hir::literal::Literal">Literal</a>&gt; for <a class="struct" href="regex_syntax/hir/literal/struct.Seq.html" title="struct regex_syntax::hir::literal::Seq">Seq</a>',
        ],
      ],
    ],
    [
      'semver',
      [
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/iter/traits/collect/trait.FromIterator.html" title="trait core::iter::traits::collect::FromIterator">FromIterator</a>&lt;<a class="struct" href="semver/struct.Comparator.html" title="struct semver::Comparator">Comparator</a>&gt; for <a class="struct" href="semver/struct.VersionReq.html" title="struct semver::VersionReq">VersionReq</a>',
        ],
      ],
    ],
    [
      'serde_json',
      [
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/iter/traits/collect/trait.FromIterator.html" title="trait core::iter::traits::collect::FromIterator">FromIterator</a>&lt;(<a class="struct" href="https://doc.rust-lang.org/nightly/alloc/string/struct.String.html" title="struct alloc::string::String">String</a>, <a class="enum" href="serde_json/enum.Value.html" title="enum serde_json::Value">Value</a>)&gt; for <a class="struct" href="serde_json/struct.Map.html" title="struct serde_json::Map">Map</a>&lt;<a class="struct" href="https://doc.rust-lang.org/nightly/alloc/string/struct.String.html" title="struct alloc::string::String">String</a>, <a class="enum" href="serde_json/enum.Value.html" title="enum serde_json::Value">Value</a>&gt;',
        ],
        [
          'impl&lt;K: <a class="trait" href="https://doc.rust-lang.org/nightly/core/convert/trait.Into.html" title="trait core::convert::Into">Into</a>&lt;<a class="struct" href="https://doc.rust-lang.org/nightly/alloc/string/struct.String.html" title="struct alloc::string::String">String</a>&gt;, V: <a class="trait" href="https://doc.rust-lang.org/nightly/core/convert/trait.Into.html" title="trait core::convert::Into">Into</a>&lt;<a class="enum" href="serde_json/enum.Value.html" title="enum serde_json::Value">Value</a>&gt;&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/iter/traits/collect/trait.FromIterator.html" title="trait core::iter::traits::collect::FromIterator">FromIterator</a>&lt;<a class="primitive" href="https://doc.rust-lang.org/nightly/std/primitive.tuple.html">(K, V)</a>&gt; for <a class="enum" href="serde_json/enum.Value.html" title="enum serde_json::Value">Value</a>',
        ],
        [
          'impl&lt;T: <a class="trait" href="https://doc.rust-lang.org/nightly/core/convert/trait.Into.html" title="trait core::convert::Into">Into</a>&lt;<a class="enum" href="serde_json/enum.Value.html" title="enum serde_json::Value">Value</a>&gt;&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/iter/traits/collect/trait.FromIterator.html" title="trait core::iter::traits::collect::FromIterator">FromIterator</a>&lt;T&gt; for <a class="enum" href="serde_json/enum.Value.html" title="enum serde_json::Value">Value</a>',
        ],
      ],
    ],
    [
      'syn',
      [
        [
          'impl&lt;T, P&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/iter/traits/collect/trait.FromIterator.html" title="trait core::iter::traits::collect::FromIterator">FromIterator</a>&lt;<a class="enum" href="syn/punctuated/enum.Pair.html" title="enum syn::punctuated::Pair">Pair</a>&lt;T, P&gt;&gt; for <a class="struct" href="syn/punctuated/struct.Punctuated.html" title="struct syn::punctuated::Punctuated">Punctuated</a>&lt;T, P&gt;',
        ],
        [
          'impl&lt;T, P&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/iter/traits/collect/trait.FromIterator.html" title="trait core::iter::traits::collect::FromIterator">FromIterator</a>&lt;T&gt; for <a class="struct" href="syn/punctuated/struct.Punctuated.html" title="struct syn::punctuated::Punctuated">Punctuated</a>&lt;T, P&gt;<div class="where">where\n    P: <a class="trait" href="https://doc.rust-lang.org/nightly/core/default/trait.Default.html" title="trait core::default::Default">Default</a>,</div>',
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
//{"start":57,"fragment_lengths":[447,477,910,491,439,2317,1027]}
