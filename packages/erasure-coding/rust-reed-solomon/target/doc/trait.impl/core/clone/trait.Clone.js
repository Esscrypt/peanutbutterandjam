;(() => {
  var implementors = Object.fromEntries([
    [
      'aho_corasick',
      [
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="aho_corasick/automaton/enum.Candidate.html" title="enum aho_corasick::automaton::Candidate">Candidate</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="aho_corasick/enum.AhoCorasickKind.html" title="enum aho_corasick::AhoCorasickKind">AhoCorasickKind</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="aho_corasick/enum.Anchored.html" title="enum aho_corasick::Anchored">Anchored</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="aho_corasick/enum.MatchErrorKind.html" title="enum aho_corasick::MatchErrorKind">MatchErrorKind</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="aho_corasick/enum.MatchKind.html" title="enum aho_corasick::MatchKind">MatchKind</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="aho_corasick/enum.StartKind.html" title="enum aho_corasick::StartKind">StartKind</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="aho_corasick/packed/enum.MatchKind.html" title="enum aho_corasick::packed::MatchKind">MatchKind</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="aho_corasick/automaton/struct.OverlappingState.html" title="struct aho_corasick::automaton::OverlappingState">OverlappingState</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="aho_corasick/automaton/struct.Prefilter.html" title="struct aho_corasick::automaton::Prefilter">Prefilter</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="aho_corasick/automaton/struct.StateID.html" title="struct aho_corasick::automaton::StateID">StateID</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="aho_corasick/automaton/struct.StateIDError.html" title="struct aho_corasick::automaton::StateIDError">StateIDError</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="aho_corasick/dfa/struct.Builder.html" title="struct aho_corasick::dfa::Builder">Builder</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="aho_corasick/dfa/struct.DFA.html" title="struct aho_corasick::dfa::DFA">DFA</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="aho_corasick/nfa/contiguous/struct.Builder.html" title="struct aho_corasick::nfa::contiguous::Builder">Builder</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="aho_corasick/nfa/contiguous/struct.NFA.html" title="struct aho_corasick::nfa::contiguous::NFA">NFA</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="aho_corasick/nfa/noncontiguous/struct.Builder.html" title="struct aho_corasick::nfa::noncontiguous::Builder">Builder</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="aho_corasick/nfa/noncontiguous/struct.NFA.html" title="struct aho_corasick::nfa::noncontiguous::NFA">NFA</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="aho_corasick/packed/struct.Builder.html" title="struct aho_corasick::packed::Builder">Builder</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="aho_corasick/packed/struct.Config.html" title="struct aho_corasick::packed::Config">Config</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="aho_corasick/packed/struct.Searcher.html" title="struct aho_corasick::packed::Searcher">Searcher</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="aho_corasick/struct.AhoCorasick.html" title="struct aho_corasick::AhoCorasick">AhoCorasick</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="aho_corasick/struct.AhoCorasickBuilder.html" title="struct aho_corasick::AhoCorasickBuilder">AhoCorasickBuilder</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="aho_corasick/struct.BuildError.html" title="struct aho_corasick::BuildError">BuildError</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="aho_corasick/struct.Match.html" title="struct aho_corasick::Match">Match</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="aho_corasick/struct.MatchError.html" title="struct aho_corasick::MatchError">MatchError</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="aho_corasick/struct.PatternID.html" title="struct aho_corasick::PatternID">PatternID</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="aho_corasick/struct.PatternIDError.html" title="struct aho_corasick::PatternIDError">PatternIDError</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="aho_corasick/struct.Span.html" title="struct aho_corasick::Span">Span</a>',
        ],
        [
          'impl&lt;\'h&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="aho_corasick/struct.Input.html" title="struct aho_corasick::Input">Input</a>&lt;\'h&gt;',
        ],
      ],
    ],
    [
      'convert_case',
      [
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="convert_case/enum.Boundary.html" title="enum convert_case::Boundary">Boundary</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="convert_case/enum.Case.html" title="enum convert_case::Case">Case</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="convert_case/enum.Pattern.html" title="enum convert_case::Pattern">Pattern</a>',
        ],
      ],
    ],
    [
      'fixedbitset',
      [
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="fixedbitset/struct.FixedBitSet.html" title="struct fixedbitset::FixedBitSet">FixedBitSet</a>',
        ],
      ],
    ],
    [
      'itoa',
      [
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="itoa/struct.Buffer.html" title="struct itoa::Buffer">Buffer</a>',
        ],
      ],
    ],
    [
      'memchr',
      [
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="memchr/memmem/enum.Prefilter.html" title="enum memchr::memmem::Prefilter">PrefilterConfig</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="memchr/arch/aarch64/neon/memchr/struct.One.html" title="struct memchr::arch::aarch64::neon::memchr::One">One</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="memchr/arch/aarch64/neon/memchr/struct.Three.html" title="struct memchr::arch::aarch64::neon::memchr::Three">Three</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="memchr/arch/aarch64/neon/memchr/struct.Two.html" title="struct memchr::arch::aarch64::neon::memchr::Two">Two</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="memchr/arch/aarch64/neon/packedpair/struct.Finder.html" title="struct memchr::arch::aarch64::neon::packedpair::Finder">Finder</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="memchr/arch/all/memchr/struct.One.html" title="struct memchr::arch::all::memchr::One">One</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="memchr/arch/all/memchr/struct.Three.html" title="struct memchr::arch::all::memchr::Three">Three</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="memchr/arch/all/memchr/struct.Two.html" title="struct memchr::arch::all::memchr::Two">Two</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="memchr/arch/all/packedpair/struct.Finder.html" title="struct memchr::arch::all::packedpair::Finder">Finder</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="memchr/arch/all/packedpair/struct.Pair.html" title="struct memchr::arch::all::packedpair::Pair">Pair</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="memchr/arch/all/rabinkarp/struct.Finder.html" title="struct memchr::arch::all::rabinkarp::Finder">Finder</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="memchr/arch/all/rabinkarp/struct.FinderRev.html" title="struct memchr::arch::all::rabinkarp::FinderRev">FinderRev</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="memchr/arch/all/twoway/struct.Finder.html" title="struct memchr::arch::all::twoway::Finder">Finder</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="memchr/arch/all/twoway/struct.FinderRev.html" title="struct memchr::arch::all::twoway::FinderRev">FinderRev</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="memchr/memmem/struct.FinderBuilder.html" title="struct memchr::memmem::FinderBuilder">FinderBuilder</a>',
        ],
        [
          'impl&lt;\'a, \'h&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="memchr/arch/aarch64/neon/memchr/struct.OneIter.html" title="struct memchr::arch::aarch64::neon::memchr::OneIter">OneIter</a>&lt;\'a, \'h&gt;',
        ],
        [
          'impl&lt;\'a, \'h&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="memchr/arch/aarch64/neon/memchr/struct.ThreeIter.html" title="struct memchr::arch::aarch64::neon::memchr::ThreeIter">ThreeIter</a>&lt;\'a, \'h&gt;',
        ],
        [
          'impl&lt;\'a, \'h&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="memchr/arch/aarch64/neon/memchr/struct.TwoIter.html" title="struct memchr::arch::aarch64::neon::memchr::TwoIter">TwoIter</a>&lt;\'a, \'h&gt;',
        ],
        [
          'impl&lt;\'a, \'h&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="memchr/arch/all/memchr/struct.OneIter.html" title="struct memchr::arch::all::memchr::OneIter">OneIter</a>&lt;\'a, \'h&gt;',
        ],
        [
          'impl&lt;\'a, \'h&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="memchr/arch/all/memchr/struct.ThreeIter.html" title="struct memchr::arch::all::memchr::ThreeIter">ThreeIter</a>&lt;\'a, \'h&gt;',
        ],
        [
          'impl&lt;\'a, \'h&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="memchr/arch/all/memchr/struct.TwoIter.html" title="struct memchr::arch::all::memchr::TwoIter">TwoIter</a>&lt;\'a, \'h&gt;',
        ],
        [
          'impl&lt;\'h&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="memchr/struct.Memchr.html" title="struct memchr::Memchr">Memchr</a>&lt;\'h&gt;',
        ],
        [
          'impl&lt;\'h&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="memchr/struct.Memchr2.html" title="struct memchr::Memchr2">Memchr2</a>&lt;\'h&gt;',
        ],
        [
          'impl&lt;\'h&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="memchr/struct.Memchr3.html" title="struct memchr::Memchr3">Memchr3</a>&lt;\'h&gt;',
        ],
        [
          'impl&lt;\'h, \'n&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="memchr/memmem/struct.FindIter.html" title="struct memchr::memmem::FindIter">FindIter</a>&lt;\'h, \'n&gt;',
        ],
        [
          'impl&lt;\'h, \'n&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="memchr/memmem/struct.FindRevIter.html" title="struct memchr::memmem::FindRevIter">FindRevIter</a>&lt;\'h, \'n&gt;',
        ],
        [
          'impl&lt;\'n&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="memchr/memmem/struct.Finder.html" title="struct memchr::memmem::Finder">Finder</a>&lt;\'n&gt;',
        ],
        [
          'impl&lt;\'n&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="memchr/memmem/struct.FinderRev.html" title="struct memchr::memmem::FinderRev">FinderRev</a>&lt;\'n&gt;',
        ],
      ],
    ],
    [
      'napi',
      [
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="napi/enum.Status.html" title="enum napi::Status">Status</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="napi/enum.TypedArrayType.html" title="enum napi::TypedArrayType">TypedArrayType</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="napi/enum.ValueType.html" title="enum napi::ValueType">ValueType</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="napi/threadsafe_function/enum.ThreadsafeFunctionCallMode.html" title="enum napi::threadsafe_function::ThreadsafeFunctionCallMode">ThreadsafeFunctionCallMode</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi/bindgen_prelude/struct.Buffer.html" title="struct napi::bindgen_prelude::Buffer">Buffer</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi/bindgen_prelude/struct.Float32Array.html" title="struct napi::bindgen_prelude::Float32Array">Float32Array</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi/bindgen_prelude/struct.Float64Array.html" title="struct napi::bindgen_prelude::Float64Array">Float64Array</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi/bindgen_prelude/struct.Int16Array.html" title="struct napi::bindgen_prelude::Int16Array">Int16Array</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi/bindgen_prelude/struct.Int32Array.html" title="struct napi::bindgen_prelude::Int32Array">Int32Array</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi/bindgen_prelude/struct.Int8Array.html" title="struct napi::bindgen_prelude::Int8Array">Int8Array</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi/bindgen_prelude/struct.Null.html" title="struct napi::bindgen_prelude::Null">Null</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi/bindgen_prelude/struct.Uint16Array.html" title="struct napi::bindgen_prelude::Uint16Array">Uint16Array</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi/bindgen_prelude/struct.Uint32Array.html" title="struct napi::bindgen_prelude::Uint32Array">Uint32Array</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi/bindgen_prelude/struct.Uint8Array.html" title="struct napi::bindgen_prelude::Uint8Array">Uint8Array</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi/bindgen_prelude/struct.Uint8ClampedArray.html" title="struct napi::bindgen_prelude::Uint8ClampedArray">Uint8ClampedArray</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi/struct.Env.html" title="struct napi::Env">Env</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi/struct.ExtendedErrorInfo.html" title="struct napi::ExtendedErrorInfo">ExtendedErrorInfo</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi/struct.JsBoolean.html" title="struct napi::JsBoolean">JsBoolean</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi/struct.JsNull.html" title="struct napi::JsNull">JsNull</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi/struct.JsNumber.html" title="struct napi::JsNumber">JsNumber</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi/struct.JsString.html" title="struct napi::JsString">JsString</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi/struct.JsSymbol.html" title="struct napi::JsSymbol">JsSymbol</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi/struct.JsUndefined.html" title="struct napi::JsUndefined">JsUndefined</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi/struct.NodeVersion.html" title="struct napi::NodeVersion">NodeVersion</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi/struct.Property.html" title="struct napi::Property">Property</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi/struct.PropertyAttributes.html" title="struct napi::PropertyAttributes">PropertyAttributes</a>',
        ],
        [
          'impl&lt;A: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, B: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="napi/enum.Either.html" title="enum napi::Either">Either</a>&lt;A, B&gt;',
        ],
        [
          'impl&lt;A: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, B: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, C: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="napi/bindgen_prelude/enum.Either3.html" title="enum napi::bindgen_prelude::Either3">Either3</a>&lt;A, B, C&gt;',
        ],
        [
          'impl&lt;A: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, B: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, C: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, D: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="napi/bindgen_prelude/enum.Either4.html" title="enum napi::bindgen_prelude::Either4">Either4</a>&lt;A, B, C, D&gt;',
        ],
        [
          'impl&lt;A: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, B: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, C: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, D: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, E: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="napi/bindgen_prelude/enum.Either5.html" title="enum napi::bindgen_prelude::Either5">Either5</a>&lt;A, B, C, D, E&gt;',
        ],
        [
          'impl&lt;A: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, B: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, C: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, D: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, E: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, F: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="napi/bindgen_prelude/enum.Either6.html" title="enum napi::bindgen_prelude::Either6">Either6</a>&lt;A, B, C, D, E, F&gt;',
        ],
        [
          'impl&lt;A: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, B: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, C: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, D: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, E: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, F: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, G: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="napi/bindgen_prelude/enum.Either7.html" title="enum napi::bindgen_prelude::Either7">Either7</a>&lt;A, B, C, D, E, F, G&gt;',
        ],
        [
          'impl&lt;A: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, B: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, C: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, D: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, E: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, F: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, G: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, H: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="napi/bindgen_prelude/enum.Either8.html" title="enum napi::bindgen_prelude::Either8">Either8</a>&lt;A, B, C, D, E, F, G, H&gt;',
        ],
        [
          'impl&lt;A: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, B: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, C: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, D: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, E: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, F: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, G: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, H: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, I: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="napi/bindgen_prelude/enum.Either9.html" title="enum napi::bindgen_prelude::Either9">Either9</a>&lt;A, B, C, D, E, F, G, H, I&gt;',
        ],
        [
          'impl&lt;A: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, B: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, C: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, D: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, E: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, F: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, G: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, H: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, I: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, J: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="napi/bindgen_prelude/enum.Either10.html" title="enum napi::bindgen_prelude::Either10">Either10</a>&lt;A, B, C, D, E, F, G, H, I, J&gt;',
        ],
        [
          'impl&lt;A: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, B: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, C: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, D: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, E: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, F: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, G: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, H: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, I: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, J: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, K: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="napi/bindgen_prelude/enum.Either11.html" title="enum napi::bindgen_prelude::Either11">Either11</a>&lt;A, B, C, D, E, F, G, H, I, J, K&gt;',
        ],
        [
          'impl&lt;A: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, B: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, C: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, D: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, E: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, F: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, G: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, H: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, I: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, J: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, K: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, L: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="napi/bindgen_prelude/enum.Either12.html" title="enum napi::bindgen_prelude::Either12">Either12</a>&lt;A, B, C, D, E, F, G, H, I, J, K, L&gt;',
        ],
        [
          'impl&lt;A: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, B: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, C: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, D: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, E: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, F: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, G: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, H: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, I: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, J: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, K: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, L: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, M: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="napi/bindgen_prelude/enum.Either13.html" title="enum napi::bindgen_prelude::Either13">Either13</a>&lt;A, B, C, D, E, F, G, H, I, J, K, L, M&gt;',
        ],
        [
          'impl&lt;A: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, B: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, C: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, D: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, E: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, F: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, G: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, H: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, I: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, J: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, K: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, L: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, M: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, N: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="napi/bindgen_prelude/enum.Either14.html" title="enum napi::bindgen_prelude::Either14">Either14</a>&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N&gt;',
        ],
        [
          'impl&lt;A: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, B: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, C: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, D: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, E: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, F: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, G: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, H: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, I: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, J: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, K: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, L: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, M: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, N: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, O: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="napi/bindgen_prelude/enum.Either15.html" title="enum napi::bindgen_prelude::Either15">Either15</a>&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N, O&gt;',
        ],
        [
          'impl&lt;A: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, B: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, C: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, D: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, E: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, F: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, G: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, H: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, I: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, J: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, K: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, L: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, M: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, N: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, O: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, P: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="napi/bindgen_prelude/enum.Either16.html" title="enum napi::bindgen_prelude::Either16">Either16</a>&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P&gt;',
        ],
        [
          'impl&lt;A: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, B: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, C: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, D: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, E: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, F: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, G: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, H: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, I: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, J: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, K: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, L: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, M: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, N: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, O: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, P: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, Q: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="napi/bindgen_prelude/enum.Either17.html" title="enum napi::bindgen_prelude::Either17">Either17</a>&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q&gt;',
        ],
        [
          'impl&lt;A: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, B: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, C: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, D: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, E: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, F: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, G: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, H: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, I: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, J: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, K: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, L: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, M: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, N: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, O: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, P: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, Q: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, R: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="napi/bindgen_prelude/enum.Either18.html" title="enum napi::bindgen_prelude::Either18">Either18</a>&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R&gt;',
        ],
        [
          'impl&lt;A: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, B: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, C: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, D: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, E: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, F: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, G: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, H: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, I: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, J: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, K: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, L: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, M: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, N: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, O: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, P: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, Q: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, R: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, S: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="napi/bindgen_prelude/enum.Either19.html" title="enum napi::bindgen_prelude::Either19">Either19</a>&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S&gt;',
        ],
        [
          'impl&lt;A: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, B: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, C: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, D: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, E: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, F: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, G: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, H: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, I: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, J: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, K: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, L: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, M: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, N: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, O: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, P: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, Q: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, R: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, S: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, T: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="napi/bindgen_prelude/enum.Either20.html" title="enum napi::bindgen_prelude::Either20">Either20</a>&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T&gt;',
        ],
        [
          'impl&lt;A: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, B: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, C: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, D: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, E: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, F: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, G: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, H: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, I: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, J: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, K: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, L: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, M: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, N: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, O: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, P: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, Q: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, R: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, S: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, T: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, U: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="napi/bindgen_prelude/enum.Either21.html" title="enum napi::bindgen_prelude::Either21">Either21</a>&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U&gt;',
        ],
        [
          'impl&lt;A: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, B: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, C: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, D: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, E: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, F: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, G: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, H: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, I: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, J: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, K: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, L: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, M: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, N: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, O: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, P: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, Q: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, R: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, S: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, T: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, U: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, V: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="napi/bindgen_prelude/enum.Either22.html" title="enum napi::bindgen_prelude::Either22">Either22</a>&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V&gt;',
        ],
        [
          'impl&lt;A: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, B: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, C: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, D: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, E: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, F: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, G: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, H: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, I: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, J: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, K: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, L: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, M: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, N: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, O: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, P: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, Q: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, R: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, S: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, T: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, U: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, V: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, W: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="napi/bindgen_prelude/enum.Either23.html" title="enum napi::bindgen_prelude::Either23">Either23</a>&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W&gt;',
        ],
        [
          'impl&lt;A: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, B: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, C: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, D: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, E: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, F: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, G: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, H: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, I: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, J: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, K: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, L: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, M: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, N: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, O: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, P: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, Q: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, R: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, S: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, T: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, U: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, V: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, W: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, X: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="napi/bindgen_prelude/enum.Either24.html" title="enum napi::bindgen_prelude::Either24">Either24</a>&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X&gt;',
        ],
        [
          'impl&lt;A: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, B: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, C: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, D: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, E: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, F: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, G: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, H: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, I: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, J: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, K: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, L: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, M: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, N: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, O: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, P: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, Q: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, R: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, S: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, T: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, U: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, V: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, W: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, X: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, Y: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="napi/bindgen_prelude/enum.Either25.html" title="enum napi::bindgen_prelude::Either25">Either25</a>&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y&gt;',
        ],
        [
          'impl&lt;A: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, B: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, C: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, D: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, E: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, F: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, G: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, H: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, I: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, J: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, K: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, L: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, M: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, N: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, O: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, P: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, Q: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, R: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, S: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, T: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, U: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, V: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, W: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, X: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, Y: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, Z: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="napi/bindgen_prelude/enum.Either26.html" title="enum napi::bindgen_prelude::Either26">Either26</a>&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z&gt;',
        ],
        [
          'impl&lt;Data: <a class="trait" href="napi/bindgen_prelude/trait.ToNapiValue.html" title="trait napi::bindgen_prelude::ToNapiValue">ToNapiValue</a>, Resolver: <a class="trait" href="https://doc.rust-lang.org/nightly/core/ops/function/trait.FnOnce.html" title="trait core::ops::function::FnOnce">FnOnce</a>(<a class="struct" href="napi/struct.Env.html" title="struct napi::Env">Env</a>) -&gt; <a class="type" href="napi/type.Result.html" title="type napi::Result">Result</a>&lt;Data&gt;&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi/struct.JsDeferred.html" title="struct napi::JsDeferred">JsDeferred</a>&lt;Data, Resolver&gt;',
        ],
        [
          'impl&lt;S: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> + <a class="trait" href="https://doc.rust-lang.org/nightly/core/convert/trait.AsRef.html" title="trait core::convert::AsRef">AsRef</a>&lt;<a class="primitive" href="https://doc.rust-lang.org/nightly/std/primitive.str.html">str</a>&gt;&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi/struct.Error.html" title="struct napi::Error">Error</a>&lt;S&gt;',
        ],
        [
          'impl&lt;T&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi/bindgen_prelude/struct.WeakReference.html" title="struct napi::bindgen_prelude::WeakReference">WeakReference</a>&lt;T&gt;',
        ],
        [
          'impl&lt;T: \'static, ES: <a class="trait" href="napi/threadsafe_function/ErrorStrategy/trait.ErrorStrategy.html" title="trait napi::threadsafe_function::ErrorStrategy::ErrorStrategy">T</a>&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi/threadsafe_function/struct.ThreadsafeFunction.html" title="struct napi::threadsafe_function::ThreadsafeFunction">ThreadsafeFunction</a>&lt;T, ES&gt;',
        ],
        [
          'impl&lt;T: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> + \'static&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi/struct.CleanupEnvHook.html" title="struct napi::CleanupEnvHook">CleanupEnvHook</a>&lt;T&gt;',
        ],
      ],
    ],
    [
      'napi_derive_backend',
      [
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="napi_derive_backend/ast/enum.FnKind.html" title="enum napi_derive_backend::ast::FnKind">FnKind</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="napi_derive_backend/ast/enum.FnSelf.html" title="enum napi_derive_backend::ast::FnSelf">FnSelf</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="napi_derive_backend/ast/enum.NapiEnumValue.html" title="enum napi_derive_backend::ast::NapiEnumValue">NapiEnumValue</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="napi_derive_backend/ast/enum.NapiFnArgKind.html" title="enum napi_derive_backend::ast::NapiFnArgKind">NapiFnArgKind</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="napi_derive_backend/ast/enum.NapiStructKind.html" title="enum napi_derive_backend::ast::NapiStructKind">NapiStructKind</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi_derive_backend/ast/struct.CallbackArg.html" title="struct napi_derive_backend::ast::CallbackArg">CallbackArg</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi_derive_backend/ast/struct.NapiConst.html" title="struct napi_derive_backend::ast::NapiConst">NapiConst</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi_derive_backend/ast/struct.NapiEnum.html" title="struct napi_derive_backend::ast::NapiEnum">NapiEnum</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi_derive_backend/ast/struct.NapiEnumVariant.html" title="struct napi_derive_backend::ast::NapiEnumVariant">NapiEnumVariant</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi_derive_backend/ast/struct.NapiFn.html" title="struct napi_derive_backend::ast::NapiFn">NapiFn</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi_derive_backend/ast/struct.NapiFnArg.html" title="struct napi_derive_backend::ast::NapiFnArg">NapiFnArg</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi_derive_backend/ast/struct.NapiImpl.html" title="struct napi_derive_backend::ast::NapiImpl">NapiImpl</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi_derive_backend/ast/struct.NapiMod.html" title="struct napi_derive_backend::ast::NapiMod">NapiMod</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi_derive_backend/ast/struct.NapiStruct.html" title="struct napi_derive_backend::ast::NapiStruct">NapiStruct</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi_derive_backend/ast/struct.NapiStructField.html" title="struct napi_derive_backend::ast::NapiStructField">NapiStructField</a>',
        ],
      ],
    ],
    [
      'napi_sys',
      [
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="napi_sys/enum.uv_run_mode.html" title="enum napi_sys::uv_run_mode">uv_run_mode</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi_sys/struct.napi_async_context__.html" title="struct napi_sys::napi_async_context__">napi_async_context__</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi_sys/struct.napi_async_work__.html" title="struct napi_sys::napi_async_work__">napi_async_work__</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi_sys/struct.napi_callback_info__.html" title="struct napi_sys::napi_callback_info__">napi_callback_info__</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi_sys/struct.napi_callback_scope__.html" title="struct napi_sys::napi_callback_scope__">napi_callback_scope__</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi_sys/struct.napi_deferred__.html" title="struct napi_sys::napi_deferred__">napi_deferred__</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi_sys/struct.napi_env__.html" title="struct napi_sys::napi_env__">napi_env__</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi_sys/struct.napi_escapable_handle_scope__.html" title="struct napi_sys::napi_escapable_handle_scope__">napi_escapable_handle_scope__</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi_sys/struct.napi_extended_error_info.html" title="struct napi_sys::napi_extended_error_info">napi_extended_error_info</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi_sys/struct.napi_handle_scope__.html" title="struct napi_sys::napi_handle_scope__">napi_handle_scope__</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi_sys/struct.napi_module.html" title="struct napi_sys::napi_module">napi_module</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi_sys/struct.napi_node_version.html" title="struct napi_sys::napi_node_version">napi_node_version</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi_sys/struct.napi_property_descriptor.html" title="struct napi_sys::napi_property_descriptor">napi_property_descriptor</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi_sys/struct.napi_ref__.html" title="struct napi_sys::napi_ref__">napi_ref__</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi_sys/struct.napi_threadsafe_function__.html" title="struct napi_sys::napi_threadsafe_function__">napi_threadsafe_function__</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi_sys/struct.napi_value__.html" title="struct napi_sys::napi_value__">napi_value__</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="napi_sys/struct.uv_loop_s.html" title="struct napi_sys::uv_loop_s">uv_loop_s</a>',
        ],
      ],
    ],
    [
      'once_cell',
      [
        [
          'impl&lt;T: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="once_cell/race/struct.OnceBox.html" title="struct once_cell::race::OnceBox">OnceBox</a>&lt;T&gt;',
        ],
        [
          'impl&lt;T: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="once_cell/sync/struct.OnceCell.html" title="struct once_cell::sync::OnceCell">OnceCell</a>&lt;T&gt;',
        ],
        [
          'impl&lt;T: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="once_cell/unsync/struct.OnceCell.html" title="struct once_cell::unsync::OnceCell">OnceCell</a>&lt;T&gt;',
        ],
      ],
    ],
    [
      'proc_macro2',
      [
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="proc_macro2/enum.Delimiter.html" title="enum proc_macro2::Delimiter">Delimiter</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="proc_macro2/enum.Spacing.html" title="enum proc_macro2::Spacing">Spacing</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="proc_macro2/enum.TokenTree.html" title="enum proc_macro2::TokenTree">TokenTree</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="proc_macro2/extra/struct.DelimSpan.html" title="struct proc_macro2::extra::DelimSpan">DelimSpan</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="proc_macro2/struct.Group.html" title="struct proc_macro2::Group">Group</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="proc_macro2/struct.Ident.html" title="struct proc_macro2::Ident">Ident</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="proc_macro2/struct.Literal.html" title="struct proc_macro2::Literal">Literal</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="proc_macro2/struct.Punct.html" title="struct proc_macro2::Punct">Punct</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="proc_macro2/struct.Span.html" title="struct proc_macro2::Span">Span</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="proc_macro2/struct.TokenStream.html" title="struct proc_macro2::TokenStream">TokenStream</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="proc_macro2/token_stream/struct.IntoIter.html" title="struct proc_macro2::token_stream::IntoIter">IntoIter</a>',
        ],
      ],
    ],
    [
      'reed_solomon_simd',
      [
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="reed_solomon_simd/enum.Error.html" title="enum reed_solomon_simd::Error">Error</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="reed_solomon_simd/engine/struct.Naive.html" title="struct reed_solomon_simd::engine::Naive">Naive</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="reed_solomon_simd/engine/struct.Neon.html" title="struct reed_solomon_simd::engine::Neon">Neon</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="reed_solomon_simd/engine/struct.NoSimd.html" title="struct reed_solomon_simd::engine::NoSimd">NoSimd</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="reed_solomon_simd/engine/tables/struct.Multiply128lutT.html" title="struct reed_solomon_simd::engine::tables::Multiply128lutT">Multiply128lutT</a>',
        ],
      ],
    ],
    [
      'regex',
      [
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="regex/enum.Error.html" title="enum regex::Error">Error</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex/bytes/struct.CaptureLocations.html" title="struct regex::bytes::CaptureLocations">CaptureLocations</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex/bytes/struct.Regex.html" title="struct regex::bytes::Regex">Regex</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex/bytes/struct.RegexBuilder.html" title="struct regex::bytes::RegexBuilder">RegexBuilder</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex/bytes/struct.RegexSet.html" title="struct regex::bytes::RegexSet">RegexSet</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex/bytes/struct.RegexSetBuilder.html" title="struct regex::bytes::RegexSetBuilder">RegexSetBuilder</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex/bytes/struct.SetMatches.html" title="struct regex::bytes::SetMatches">SetMatches</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex/struct.CaptureLocations.html" title="struct regex::CaptureLocations">CaptureLocations</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex/struct.Regex.html" title="struct regex::Regex">Regex</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex/struct.RegexBuilder.html" title="struct regex::RegexBuilder">RegexBuilder</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex/struct.RegexSet.html" title="struct regex::RegexSet">RegexSet</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex/struct.RegexSetBuilder.html" title="struct regex::RegexSetBuilder">RegexSetBuilder</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex/struct.SetMatches.html" title="struct regex::SetMatches">SetMatches</a>',
        ],
        [
          'impl&lt;\'a&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex/bytes/struct.SetMatchesIter.html" title="struct regex::bytes::SetMatchesIter">SetMatchesIter</a>&lt;\'a&gt;',
        ],
        [
          'impl&lt;\'a&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex/struct.SetMatchesIter.html" title="struct regex::SetMatchesIter">SetMatchesIter</a>&lt;\'a&gt;',
        ],
        [
          'impl&lt;\'c, \'h&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex/bytes/struct.SubCaptureMatches.html" title="struct regex::bytes::SubCaptureMatches">SubCaptureMatches</a>&lt;\'c, \'h&gt;',
        ],
        [
          'impl&lt;\'c, \'h&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex/struct.SubCaptureMatches.html" title="struct regex::SubCaptureMatches">SubCaptureMatches</a>&lt;\'c, \'h&gt;',
        ],
        [
          'impl&lt;\'h&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex/bytes/struct.Match.html" title="struct regex::bytes::Match">Match</a>&lt;\'h&gt;',
        ],
        [
          'impl&lt;\'h&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex/struct.Match.html" title="struct regex::Match">Match</a>&lt;\'h&gt;',
        ],
        [
          'impl&lt;\'r&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex/bytes/struct.CaptureNames.html" title="struct regex::bytes::CaptureNames">CaptureNames</a>&lt;\'r&gt;',
        ],
        [
          'impl&lt;\'r&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex/struct.CaptureNames.html" title="struct regex::CaptureNames">CaptureNames</a>&lt;\'r&gt;',
        ],
        [
          'impl&lt;\'s&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex/bytes/struct.NoExpand.html" title="struct regex::bytes::NoExpand">NoExpand</a>&lt;\'s&gt;',
        ],
        [
          'impl&lt;\'s&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex/struct.NoExpand.html" title="struct regex::NoExpand">NoExpand</a>&lt;\'s&gt;',
        ],
      ],
    ],
    [
      'regex_automata',
      [
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="regex_automata/enum.Anchored.html" title="enum regex_automata::Anchored">Anchored</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="regex_automata/enum.MatchErrorKind.html" title="enum regex_automata::MatchErrorKind">MatchErrorKind</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="regex_automata/enum.MatchKind.html" title="enum regex_automata::MatchKind">MatchKind</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="regex_automata/hybrid/enum.StartError.html" title="enum regex_automata::hybrid::StartError">StartError</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="regex_automata/nfa/thompson/enum.State.html" title="enum regex_automata::nfa::thompson::State">State</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="regex_automata/nfa/thompson/enum.WhichCaptures.html" title="enum regex_automata::nfa::thompson::WhichCaptures">WhichCaptures</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="regex_automata/util/look/enum.Look.html" title="enum regex_automata::util::look::Look">Look</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/dfa/onepass/struct.BuildError.html" title="struct regex_automata::dfa::onepass::BuildError">BuildError</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/dfa/onepass/struct.Builder.html" title="struct regex_automata::dfa::onepass::Builder">Builder</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/dfa/onepass/struct.Cache.html" title="struct regex_automata::dfa::onepass::Cache">Cache</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/dfa/onepass/struct.Config.html" title="struct regex_automata::dfa::onepass::Config">Config</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/dfa/onepass/struct.DFA.html" title="struct regex_automata::dfa::onepass::DFA">DFA</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/hybrid/dfa/struct.Builder.html" title="struct regex_automata::hybrid::dfa::Builder">Builder</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/hybrid/dfa/struct.Cache.html" title="struct regex_automata::hybrid::dfa::Cache">Cache</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/hybrid/dfa/struct.Config.html" title="struct regex_automata::hybrid::dfa::Config">Config</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/hybrid/dfa/struct.DFA.html" title="struct regex_automata::hybrid::dfa::DFA">DFA</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/hybrid/dfa/struct.OverlappingState.html" title="struct regex_automata::hybrid::dfa::OverlappingState">OverlappingState</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/hybrid/regex/struct.Builder.html" title="struct regex_automata::hybrid::regex::Builder">Builder</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/hybrid/regex/struct.Cache.html" title="struct regex_automata::hybrid::regex::Cache">Cache</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/hybrid/struct.BuildError.html" title="struct regex_automata::hybrid::BuildError">BuildError</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/hybrid/struct.CacheError.html" title="struct regex_automata::hybrid::CacheError">CacheError</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/hybrid/struct.LazyStateID.html" title="struct regex_automata::hybrid::LazyStateID">LazyStateID</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/meta/struct.BuildError.html" title="struct regex_automata::meta::BuildError">BuildError</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/meta/struct.Builder.html" title="struct regex_automata::meta::Builder">Builder</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/meta/struct.Cache.html" title="struct regex_automata::meta::Cache">Cache</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/meta/struct.Config.html" title="struct regex_automata::meta::Config">Config</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/meta/struct.Regex.html" title="struct regex_automata::meta::Regex">Regex</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/nfa/thompson/backtrack/struct.BoundedBacktracker.html" title="struct regex_automata::nfa::thompson::backtrack::BoundedBacktracker">BoundedBacktracker</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/nfa/thompson/backtrack/struct.Builder.html" title="struct regex_automata::nfa::thompson::backtrack::Builder">Builder</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/nfa/thompson/backtrack/struct.Cache.html" title="struct regex_automata::nfa::thompson::backtrack::Cache">Cache</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/nfa/thompson/backtrack/struct.Config.html" title="struct regex_automata::nfa::thompson::backtrack::Config">Config</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/nfa/thompson/pikevm/struct.Builder.html" title="struct regex_automata::nfa::thompson::pikevm::Builder">Builder</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/nfa/thompson/pikevm/struct.Cache.html" title="struct regex_automata::nfa::thompson::pikevm::Cache">Cache</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/nfa/thompson/pikevm/struct.Config.html" title="struct regex_automata::nfa::thompson::pikevm::Config">Config</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/nfa/thompson/pikevm/struct.PikeVM.html" title="struct regex_automata::nfa::thompson::pikevm::PikeVM">PikeVM</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/nfa/thompson/struct.BuildError.html" title="struct regex_automata::nfa::thompson::BuildError">BuildError</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/nfa/thompson/struct.Builder.html" title="struct regex_automata::nfa::thompson::Builder">Builder</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/nfa/thompson/struct.Compiler.html" title="struct regex_automata::nfa::thompson::Compiler">Compiler</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/nfa/thompson/struct.Config.html" title="struct regex_automata::nfa::thompson::Config">Config</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/nfa/thompson/struct.DenseTransitions.html" title="struct regex_automata::nfa::thompson::DenseTransitions">DenseTransitions</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/nfa/thompson/struct.NFA.html" title="struct regex_automata::nfa::thompson::NFA">NFA</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/nfa/thompson/struct.SparseTransitions.html" title="struct regex_automata::nfa::thompson::SparseTransitions">SparseTransitions</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/nfa/thompson/struct.Transition.html" title="struct regex_automata::nfa::thompson::Transition">Transition</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/struct.HalfMatch.html" title="struct regex_automata::HalfMatch">HalfMatch</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/struct.Match.html" title="struct regex_automata::Match">Match</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/struct.MatchError.html" title="struct regex_automata::MatchError">MatchError</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/struct.PatternID.html" title="struct regex_automata::PatternID">PatternID</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/struct.PatternSet.html" title="struct regex_automata::PatternSet">PatternSet</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/struct.PatternSetInsertError.html" title="struct regex_automata::PatternSetInsertError">PatternSetInsertError</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/struct.Span.html" title="struct regex_automata::Span">Span</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/util/alphabet/struct.ByteClasses.html" title="struct regex_automata::util::alphabet::ByteClasses">ByteClasses</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/util/alphabet/struct.Unit.html" title="struct regex_automata::util::alphabet::Unit">Unit</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/util/captures/struct.Captures.html" title="struct regex_automata::util::captures::Captures">Captures</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/util/captures/struct.GroupInfo.html" title="struct regex_automata::util::captures::GroupInfo">GroupInfo</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/util/captures/struct.GroupInfoError.html" title="struct regex_automata::util::captures::GroupInfoError">GroupInfoError</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/util/escape/struct.DebugByte.html" title="struct regex_automata::util::escape::DebugByte">DebugByte</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/util/look/struct.LookMatcher.html" title="struct regex_automata::util::look::LookMatcher">LookMatcher</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/util/look/struct.LookSet.html" title="struct regex_automata::util::look::LookSet">LookSet</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/util/look/struct.LookSetIter.html" title="struct regex_automata::util::look::LookSetIter">LookSetIter</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/util/look/struct.UnicodeWordBoundaryError.html" title="struct regex_automata::util::look::UnicodeWordBoundaryError">UnicodeWordBoundaryError</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/util/prefilter/struct.Prefilter.html" title="struct regex_automata::util::prefilter::Prefilter">Prefilter</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/util/primitives/struct.NonMaxUsize.html" title="struct regex_automata::util::primitives::NonMaxUsize">NonMaxUsize</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/util/primitives/struct.PatternIDError.html" title="struct regex_automata::util::primitives::PatternIDError">PatternIDError</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/util/primitives/struct.SmallIndex.html" title="struct regex_automata::util::primitives::SmallIndex">SmallIndex</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/util/primitives/struct.SmallIndexError.html" title="struct regex_automata::util::primitives::SmallIndexError">SmallIndexError</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/util/primitives/struct.StateID.html" title="struct regex_automata::util::primitives::StateID">StateID</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/util/primitives/struct.StateIDError.html" title="struct regex_automata::util::primitives::StateIDError">StateIDError</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/util/start/struct.Config.html" title="struct regex_automata::util::start::Config">Config</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/util/syntax/struct.Config.html" title="struct regex_automata::util::syntax::Config">Config</a>',
        ],
        [
          'impl&lt;\'a&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/struct.PatternSetIter.html" title="struct regex_automata::PatternSetIter">PatternSetIter</a>&lt;\'a&gt;',
        ],
        [
          'impl&lt;\'a&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/util/captures/struct.CapturesPatternIter.html" title="struct regex_automata::util::captures::CapturesPatternIter">CapturesPatternIter</a>&lt;\'a&gt;',
        ],
        [
          'impl&lt;\'a&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/util/captures/struct.GroupInfoPatternNames.html" title="struct regex_automata::util::captures::GroupInfoPatternNames">GroupInfoPatternNames</a>&lt;\'a&gt;',
        ],
        [
          'impl&lt;\'h&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/struct.Input.html" title="struct regex_automata::Input">Input</a>&lt;\'h&gt;',
        ],
        [
          'impl&lt;\'h&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_automata/util/iter/struct.Searcher.html" title="struct regex_automata::util::iter::Searcher">Searcher</a>&lt;\'h&gt;',
        ],
      ],
    ],
    [
      'regex_syntax',
      [
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="regex_syntax/ast/enum.AssertionKind.html" title="enum regex_syntax::ast::AssertionKind">AssertionKind</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="regex_syntax/ast/enum.Ast.html" title="enum regex_syntax::ast::Ast">Ast</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="regex_syntax/ast/enum.ClassAsciiKind.html" title="enum regex_syntax::ast::ClassAsciiKind">ClassAsciiKind</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="regex_syntax/ast/enum.ClassPerlKind.html" title="enum regex_syntax::ast::ClassPerlKind">ClassPerlKind</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="regex_syntax/ast/enum.ClassSet.html" title="enum regex_syntax::ast::ClassSet">ClassSet</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="regex_syntax/ast/enum.ClassSetBinaryOpKind.html" title="enum regex_syntax::ast::ClassSetBinaryOpKind">ClassSetBinaryOpKind</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="regex_syntax/ast/enum.ClassSetItem.html" title="enum regex_syntax::ast::ClassSetItem">ClassSetItem</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="regex_syntax/ast/enum.ClassUnicodeKind.html" title="enum regex_syntax::ast::ClassUnicodeKind">ClassUnicodeKind</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="regex_syntax/ast/enum.ClassUnicodeOpKind.html" title="enum regex_syntax::ast::ClassUnicodeOpKind">ClassUnicodeOpKind</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="regex_syntax/ast/enum.ErrorKind.html" title="enum regex_syntax::ast::ErrorKind">ErrorKind</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="regex_syntax/ast/enum.Flag.html" title="enum regex_syntax::ast::Flag">Flag</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="regex_syntax/ast/enum.FlagsItemKind.html" title="enum regex_syntax::ast::FlagsItemKind">FlagsItemKind</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="regex_syntax/ast/enum.GroupKind.html" title="enum regex_syntax::ast::GroupKind">GroupKind</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="regex_syntax/ast/enum.HexLiteralKind.html" title="enum regex_syntax::ast::HexLiteralKind">HexLiteralKind</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="regex_syntax/ast/enum.LiteralKind.html" title="enum regex_syntax::ast::LiteralKind">LiteralKind</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="regex_syntax/ast/enum.RepetitionKind.html" title="enum regex_syntax::ast::RepetitionKind">RepetitionKind</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="regex_syntax/ast/enum.RepetitionRange.html" title="enum regex_syntax::ast::RepetitionRange">RepetitionRange</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="regex_syntax/ast/enum.SpecialLiteralKind.html" title="enum regex_syntax::ast::SpecialLiteralKind">SpecialLiteralKind</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="regex_syntax/enum.Error.html" title="enum regex_syntax::Error">Error</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="regex_syntax/hir/enum.Class.html" title="enum regex_syntax::hir::Class">Class</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="regex_syntax/hir/enum.Dot.html" title="enum regex_syntax::hir::Dot">Dot</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="regex_syntax/hir/enum.ErrorKind.html" title="enum regex_syntax::hir::ErrorKind">ErrorKind</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="regex_syntax/hir/enum.HirKind.html" title="enum regex_syntax::hir::HirKind">HirKind</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="regex_syntax/hir/enum.Look.html" title="enum regex_syntax::hir::Look">Look</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="regex_syntax/hir/literal/enum.ExtractKind.html" title="enum regex_syntax::hir::literal::ExtractKind">ExtractKind</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="regex_syntax/utf8/enum.Utf8Sequence.html" title="enum regex_syntax::utf8::Utf8Sequence">Utf8Sequence</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/ast/parse/struct.Parser.html" title="struct regex_syntax::ast::parse::Parser">Parser</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/ast/parse/struct.ParserBuilder.html" title="struct regex_syntax::ast::parse::ParserBuilder">ParserBuilder</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/ast/struct.Alternation.html" title="struct regex_syntax::ast::Alternation">Alternation</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/ast/struct.Assertion.html" title="struct regex_syntax::ast::Assertion">Assertion</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/ast/struct.CaptureName.html" title="struct regex_syntax::ast::CaptureName">CaptureName</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/ast/struct.ClassAscii.html" title="struct regex_syntax::ast::ClassAscii">ClassAscii</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/ast/struct.ClassBracketed.html" title="struct regex_syntax::ast::ClassBracketed">ClassBracketed</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/ast/struct.ClassPerl.html" title="struct regex_syntax::ast::ClassPerl">ClassPerl</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/ast/struct.ClassSetBinaryOp.html" title="struct regex_syntax::ast::ClassSetBinaryOp">ClassSetBinaryOp</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/ast/struct.ClassSetRange.html" title="struct regex_syntax::ast::ClassSetRange">ClassSetRange</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/ast/struct.ClassSetUnion.html" title="struct regex_syntax::ast::ClassSetUnion">ClassSetUnion</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/ast/struct.ClassUnicode.html" title="struct regex_syntax::ast::ClassUnicode">ClassUnicode</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/ast/struct.Comment.html" title="struct regex_syntax::ast::Comment">Comment</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/ast/struct.Concat.html" title="struct regex_syntax::ast::Concat">Concat</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/ast/struct.Error.html" title="struct regex_syntax::ast::Error">Error</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/ast/struct.Flags.html" title="struct regex_syntax::ast::Flags">Flags</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/ast/struct.FlagsItem.html" title="struct regex_syntax::ast::FlagsItem">FlagsItem</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/ast/struct.Group.html" title="struct regex_syntax::ast::Group">Group</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/ast/struct.Literal.html" title="struct regex_syntax::ast::Literal">Literal</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/ast/struct.Position.html" title="struct regex_syntax::ast::Position">Position</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/ast/struct.Repetition.html" title="struct regex_syntax::ast::Repetition">Repetition</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/ast/struct.RepetitionOp.html" title="struct regex_syntax::ast::RepetitionOp">RepetitionOp</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/ast/struct.SetFlags.html" title="struct regex_syntax::ast::SetFlags">SetFlags</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/ast/struct.Span.html" title="struct regex_syntax::ast::Span">Span</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/ast/struct.WithComments.html" title="struct regex_syntax::ast::WithComments">WithComments</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/hir/literal/struct.Extractor.html" title="struct regex_syntax::hir::literal::Extractor">Extractor</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/hir/literal/struct.Literal.html" title="struct regex_syntax::hir::literal::Literal">Literal</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/hir/literal/struct.Seq.html" title="struct regex_syntax::hir::literal::Seq">Seq</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/hir/struct.Capture.html" title="struct regex_syntax::hir::Capture">Capture</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/hir/struct.ClassBytes.html" title="struct regex_syntax::hir::ClassBytes">ClassBytes</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/hir/struct.ClassBytesRange.html" title="struct regex_syntax::hir::ClassBytesRange">ClassBytesRange</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/hir/struct.ClassUnicode.html" title="struct regex_syntax::hir::ClassUnicode">ClassUnicode</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/hir/struct.ClassUnicodeRange.html" title="struct regex_syntax::hir::ClassUnicodeRange">ClassUnicodeRange</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/hir/struct.Error.html" title="struct regex_syntax::hir::Error">Error</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/hir/struct.Hir.html" title="struct regex_syntax::hir::Hir">Hir</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/hir/struct.Literal.html" title="struct regex_syntax::hir::Literal">Literal</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/hir/struct.LookSet.html" title="struct regex_syntax::hir::LookSet">LookSet</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/hir/struct.LookSetIter.html" title="struct regex_syntax::hir::LookSetIter">LookSetIter</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/hir/struct.Properties.html" title="struct regex_syntax::hir::Properties">Properties</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/hir/struct.Repetition.html" title="struct regex_syntax::hir::Repetition">Repetition</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/hir/translate/struct.Translator.html" title="struct regex_syntax::hir::translate::Translator">Translator</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/hir/translate/struct.TranslatorBuilder.html" title="struct regex_syntax::hir::translate::TranslatorBuilder">TranslatorBuilder</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/struct.Parser.html" title="struct regex_syntax::Parser">Parser</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/struct.ParserBuilder.html" title="struct regex_syntax::ParserBuilder">ParserBuilder</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="regex_syntax/utf8/struct.Utf8Range.html" title="struct regex_syntax::utf8::Utf8Range">Utf8Range</a>',
        ],
      ],
    ],
    [
      'ryu',
      [
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="ryu/struct.Buffer.html" title="struct ryu::Buffer">Buffer</a>',
        ],
      ],
    ],
    [
      'semver',
      [
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="semver/enum.Op.html" title="enum semver::Op">Op</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="semver/struct.BuildMetadata.html" title="struct semver::BuildMetadata">BuildMetadata</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="semver/struct.Comparator.html" title="struct semver::Comparator">Comparator</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="semver/struct.Prerelease.html" title="struct semver::Prerelease">Prerelease</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="semver/struct.Version.html" title="struct semver::Version">Version</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="semver/struct.VersionReq.html" title="struct semver::VersionReq">VersionReq</a>',
        ],
      ],
    ],
    [
      'serde',
      [
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="serde/de/struct.IgnoredAny.html" title="struct serde::de::IgnoredAny">IgnoredAny</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="serde/de/value/struct.Error.html" title="struct serde::de::value::Error">Error</a>',
        ],
        [
          'impl&lt;\'a&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="serde/de/enum.Unexpected.html" title="enum serde::de::Unexpected">Unexpected</a>&lt;\'a&gt;',
        ],
        [
          'impl&lt;\'a, E&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="serde/de/value/struct.BytesDeserializer.html" title="struct serde::de::value::BytesDeserializer">BytesDeserializer</a>&lt;\'a, E&gt;',
        ],
        [
          'impl&lt;\'a, E&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="serde/de/value/struct.CowStrDeserializer.html" title="struct serde::de::value::CowStrDeserializer">CowStrDeserializer</a>&lt;\'a, E&gt;',
        ],
        [
          'impl&lt;\'de, E&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="serde/de/value/struct.BorrowedBytesDeserializer.html" title="struct serde::de::value::BorrowedBytesDeserializer">BorrowedBytesDeserializer</a>&lt;\'de, E&gt;',
        ],
        [
          'impl&lt;\'de, E&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="serde/de/value/struct.BorrowedStrDeserializer.html" title="struct serde::de::value::BorrowedStrDeserializer">BorrowedStrDeserializer</a>&lt;\'de, E&gt;',
        ],
        [
          'impl&lt;\'de, E&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="serde/de/value/struct.StrDeserializer.html" title="struct serde::de::value::StrDeserializer">StrDeserializer</a>&lt;\'de, E&gt;',
        ],
        [
          'impl&lt;\'de, I, E&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="serde/de/value/struct.MapDeserializer.html" title="struct serde::de::value::MapDeserializer">MapDeserializer</a>&lt;\'de, I, E&gt;<div class="where">where\n    I: <a class="trait" href="https://doc.rust-lang.org/nightly/core/iter/traits/iterator/trait.Iterator.html" title="trait core::iter::traits::iterator::Iterator">Iterator</a> + <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>,\n    I::<a class="associatedtype" href="https://doc.rust-lang.org/nightly/core/iter/traits/iterator/trait.Iterator.html#associatedtype.Item" title="type core::iter::traits::iterator::Iterator::Item">Item</a>: Pair,\n    &lt;I::<a class="associatedtype" href="https://doc.rust-lang.org/nightly/core/iter/traits/iterator/trait.Iterator.html#associatedtype.Item" title="type core::iter::traits::iterator::Iterator::Item">Item</a> as Pair&gt;::Second: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>,</div>',
        ],
        [
          'impl&lt;A: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="serde/de/value/struct.EnumAccessDeserializer.html" title="struct serde::de::value::EnumAccessDeserializer">EnumAccessDeserializer</a>&lt;A&gt;',
        ],
        [
          'impl&lt;A: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="serde/de/value/struct.MapAccessDeserializer.html" title="struct serde::de::value::MapAccessDeserializer">MapAccessDeserializer</a>&lt;A&gt;',
        ],
        [
          'impl&lt;A: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="serde/de/value/struct.SeqAccessDeserializer.html" title="struct serde::de::value::SeqAccessDeserializer">SeqAccessDeserializer</a>&lt;A&gt;',
        ],
        [
          'impl&lt;E&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="serde/de/value/struct.BoolDeserializer.html" title="struct serde::de::value::BoolDeserializer">BoolDeserializer</a>&lt;E&gt;',
        ],
        [
          'impl&lt;E&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="serde/de/value/struct.CharDeserializer.html" title="struct serde::de::value::CharDeserializer">CharDeserializer</a>&lt;E&gt;',
        ],
        [
          'impl&lt;E&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="serde/de/value/struct.F32Deserializer.html" title="struct serde::de::value::F32Deserializer">F32Deserializer</a>&lt;E&gt;',
        ],
        [
          'impl&lt;E&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="serde/de/value/struct.F64Deserializer.html" title="struct serde::de::value::F64Deserializer">F64Deserializer</a>&lt;E&gt;',
        ],
        [
          'impl&lt;E&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="serde/de/value/struct.I128Deserializer.html" title="struct serde::de::value::I128Deserializer">I128Deserializer</a>&lt;E&gt;',
        ],
        [
          'impl&lt;E&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="serde/de/value/struct.I16Deserializer.html" title="struct serde::de::value::I16Deserializer">I16Deserializer</a>&lt;E&gt;',
        ],
        [
          'impl&lt;E&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="serde/de/value/struct.I32Deserializer.html" title="struct serde::de::value::I32Deserializer">I32Deserializer</a>&lt;E&gt;',
        ],
        [
          'impl&lt;E&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="serde/de/value/struct.I64Deserializer.html" title="struct serde::de::value::I64Deserializer">I64Deserializer</a>&lt;E&gt;',
        ],
        [
          'impl&lt;E&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="serde/de/value/struct.I8Deserializer.html" title="struct serde::de::value::I8Deserializer">I8Deserializer</a>&lt;E&gt;',
        ],
        [
          'impl&lt;E&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="serde/de/value/struct.IsizeDeserializer.html" title="struct serde::de::value::IsizeDeserializer">IsizeDeserializer</a>&lt;E&gt;',
        ],
        [
          'impl&lt;E&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="serde/de/value/struct.StringDeserializer.html" title="struct serde::de::value::StringDeserializer">StringDeserializer</a>&lt;E&gt;',
        ],
        [
          'impl&lt;E&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="serde/de/value/struct.U128Deserializer.html" title="struct serde::de::value::U128Deserializer">U128Deserializer</a>&lt;E&gt;',
        ],
        [
          'impl&lt;E&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="serde/de/value/struct.U16Deserializer.html" title="struct serde::de::value::U16Deserializer">U16Deserializer</a>&lt;E&gt;',
        ],
        [
          'impl&lt;E&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="serde/de/value/struct.U32Deserializer.html" title="struct serde::de::value::U32Deserializer">U32Deserializer</a>&lt;E&gt;',
        ],
        [
          'impl&lt;E&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="serde/de/value/struct.U64Deserializer.html" title="struct serde::de::value::U64Deserializer">U64Deserializer</a>&lt;E&gt;',
        ],
        [
          'impl&lt;E&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="serde/de/value/struct.U8Deserializer.html" title="struct serde::de::value::U8Deserializer">U8Deserializer</a>&lt;E&gt;',
        ],
        [
          'impl&lt;E&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="serde/de/value/struct.UnitDeserializer.html" title="struct serde::de::value::UnitDeserializer">UnitDeserializer</a>&lt;E&gt;',
        ],
        [
          'impl&lt;E&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="serde/de/value/struct.UsizeDeserializer.html" title="struct serde::de::value::UsizeDeserializer">UsizeDeserializer</a>&lt;E&gt;',
        ],
        [
          'impl&lt;I: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>, E: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="serde/de/value/struct.SeqDeserializer.html" title="struct serde::de::value::SeqDeserializer">SeqDeserializer</a>&lt;I, E&gt;',
        ],
      ],
    ],
    [
      'serde_json',
      [
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="serde_json/enum.Value.html" title="enum serde_json::Value">Value</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="serde_json/error/enum.Category.html" title="enum serde_json::error::Category">Category</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="serde_json/ser/struct.CompactFormatter.html" title="struct serde_json::ser::CompactFormatter">CompactFormatter</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="serde_json/struct.Map.html" title="struct serde_json::Map">Map</a>&lt;<a class="struct" href="https://doc.rust-lang.org/nightly/alloc/string/struct.String.html" title="struct alloc::string::String">String</a>, <a class="enum" href="serde_json/enum.Value.html" title="enum serde_json::Value">Value</a>&gt;',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="serde_json/struct.Number.html" title="struct serde_json::Number">Number</a>',
        ],
        [
          'impl&lt;\'a&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="serde_json/ser/struct.PrettyFormatter.html" title="struct serde_json::ser::PrettyFormatter">PrettyFormatter</a>&lt;\'a&gt;',
        ],
      ],
    ],
    [
      'syn',
      [
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="syn/enum.AttrStyle.html" title="enum syn::AttrStyle">AttrStyle</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="syn/enum.BinOp.html" title="enum syn::BinOp">BinOp</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="syn/enum.CapturedParam.html" title="enum syn::CapturedParam">CapturedParam</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="syn/enum.Data.html" title="enum syn::Data">Data</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="syn/enum.Expr.html" title="enum syn::Expr">Expr</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="syn/enum.FieldMutability.html" title="enum syn::FieldMutability">FieldMutability</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="syn/enum.Fields.html" title="enum syn::Fields">Fields</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="syn/enum.FnArg.html" title="enum syn::FnArg">FnArg</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="syn/enum.ForeignItem.html" title="enum syn::ForeignItem">ForeignItem</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="syn/enum.GenericArgument.html" title="enum syn::GenericArgument">GenericArgument</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="syn/enum.GenericParam.html" title="enum syn::GenericParam">GenericParam</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="syn/enum.ImplItem.html" title="enum syn::ImplItem">ImplItem</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="syn/enum.ImplRestriction.html" title="enum syn::ImplRestriction">ImplRestriction</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="syn/enum.Item.html" title="enum syn::Item">Item</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="syn/enum.Lit.html" title="enum syn::Lit">Lit</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="syn/enum.MacroDelimiter.html" title="enum syn::MacroDelimiter">MacroDelimiter</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="syn/enum.Member.html" title="enum syn::Member">Member</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="syn/enum.Meta.html" title="enum syn::Meta">Meta</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="syn/enum.Pat.html" title="enum syn::Pat">Pat</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="syn/enum.PathArguments.html" title="enum syn::PathArguments">PathArguments</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="syn/enum.PointerMutability.html" title="enum syn::PointerMutability">PointerMutability</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="syn/enum.RangeLimits.html" title="enum syn::RangeLimits">RangeLimits</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="syn/enum.ReturnType.html" title="enum syn::ReturnType">ReturnType</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="syn/enum.StaticMutability.html" title="enum syn::StaticMutability">StaticMutability</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="syn/enum.Stmt.html" title="enum syn::Stmt">Stmt</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="syn/enum.TraitBoundModifier.html" title="enum syn::TraitBoundModifier">TraitBoundModifier</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="syn/enum.TraitItem.html" title="enum syn::TraitItem">TraitItem</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="syn/enum.Type.html" title="enum syn::Type">Type</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="syn/enum.TypeParamBound.html" title="enum syn::TypeParamBound">TypeParamBound</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="syn/enum.UnOp.html" title="enum syn::UnOp">UnOp</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="syn/enum.UseTree.html" title="enum syn::UseTree">UseTree</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="syn/enum.Visibility.html" title="enum syn::Visibility">Visibility</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="syn/enum.WherePredicate.html" title="enum syn::WherePredicate">WherePredicate</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/parse/struct.End.html" title="struct syn::parse::End">End</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/parse/struct.Nothing.html" title="struct syn::parse::Nothing">Nothing</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.Abi.html" title="struct syn::Abi">Abi</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.AngleBracketedGenericArguments.html" title="struct syn::AngleBracketedGenericArguments">AngleBracketedGenericArguments</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.Arm.html" title="struct syn::Arm">Arm</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.AssocConst.html" title="struct syn::AssocConst">AssocConst</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.AssocType.html" title="struct syn::AssocType">AssocType</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.Attribute.html" title="struct syn::Attribute">Attribute</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.BareFnArg.html" title="struct syn::BareFnArg">BareFnArg</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.BareVariadic.html" title="struct syn::BareVariadic">BareVariadic</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.Block.html" title="struct syn::Block">Block</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.BoundLifetimes.html" title="struct syn::BoundLifetimes">BoundLifetimes</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ConstParam.html" title="struct syn::ConstParam">ConstParam</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.Constraint.html" title="struct syn::Constraint">Constraint</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.DataEnum.html" title="struct syn::DataEnum">DataEnum</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.DataStruct.html" title="struct syn::DataStruct">DataStruct</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.DataUnion.html" title="struct syn::DataUnion">DataUnion</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.DeriveInput.html" title="struct syn::DeriveInput">DeriveInput</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.Error.html" title="struct syn::Error">Error</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprArray.html" title="struct syn::ExprArray">ExprArray</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprAssign.html" title="struct syn::ExprAssign">ExprAssign</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprAsync.html" title="struct syn::ExprAsync">ExprAsync</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprAwait.html" title="struct syn::ExprAwait">ExprAwait</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprBinary.html" title="struct syn::ExprBinary">ExprBinary</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprBlock.html" title="struct syn::ExprBlock">ExprBlock</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprBreak.html" title="struct syn::ExprBreak">ExprBreak</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprCall.html" title="struct syn::ExprCall">ExprCall</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprCast.html" title="struct syn::ExprCast">ExprCast</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprClosure.html" title="struct syn::ExprClosure">ExprClosure</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprConst.html" title="struct syn::ExprConst">ExprConst</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprContinue.html" title="struct syn::ExprContinue">ExprContinue</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprField.html" title="struct syn::ExprField">ExprField</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprForLoop.html" title="struct syn::ExprForLoop">ExprForLoop</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprGroup.html" title="struct syn::ExprGroup">ExprGroup</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprIf.html" title="struct syn::ExprIf">ExprIf</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprIndex.html" title="struct syn::ExprIndex">ExprIndex</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprInfer.html" title="struct syn::ExprInfer">ExprInfer</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprLet.html" title="struct syn::ExprLet">ExprLet</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprLit.html" title="struct syn::ExprLit">ExprLit</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprLoop.html" title="struct syn::ExprLoop">ExprLoop</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprMacro.html" title="struct syn::ExprMacro">ExprMacro</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprMatch.html" title="struct syn::ExprMatch">ExprMatch</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprMethodCall.html" title="struct syn::ExprMethodCall">ExprMethodCall</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprParen.html" title="struct syn::ExprParen">ExprParen</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprPath.html" title="struct syn::ExprPath">ExprPath</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprRange.html" title="struct syn::ExprRange">ExprRange</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprRawAddr.html" title="struct syn::ExprRawAddr">ExprRawAddr</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprReference.html" title="struct syn::ExprReference">ExprReference</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprRepeat.html" title="struct syn::ExprRepeat">ExprRepeat</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprReturn.html" title="struct syn::ExprReturn">ExprReturn</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprStruct.html" title="struct syn::ExprStruct">ExprStruct</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprTry.html" title="struct syn::ExprTry">ExprTry</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprTryBlock.html" title="struct syn::ExprTryBlock">ExprTryBlock</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprTuple.html" title="struct syn::ExprTuple">ExprTuple</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprUnary.html" title="struct syn::ExprUnary">ExprUnary</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprUnsafe.html" title="struct syn::ExprUnsafe">ExprUnsafe</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprWhile.html" title="struct syn::ExprWhile">ExprWhile</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ExprYield.html" title="struct syn::ExprYield">ExprYield</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.Field.html" title="struct syn::Field">Field</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.FieldPat.html" title="struct syn::FieldPat">FieldPat</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.FieldValue.html" title="struct syn::FieldValue">FieldValue</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.FieldsNamed.html" title="struct syn::FieldsNamed">FieldsNamed</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.FieldsUnnamed.html" title="struct syn::FieldsUnnamed">FieldsUnnamed</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.File.html" title="struct syn::File">File</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ForeignItemFn.html" title="struct syn::ForeignItemFn">ForeignItemFn</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ForeignItemMacro.html" title="struct syn::ForeignItemMacro">ForeignItemMacro</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ForeignItemStatic.html" title="struct syn::ForeignItemStatic">ForeignItemStatic</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ForeignItemType.html" title="struct syn::ForeignItemType">ForeignItemType</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.Generics.html" title="struct syn::Generics">Generics</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ImplItemConst.html" title="struct syn::ImplItemConst">ImplItemConst</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ImplItemFn.html" title="struct syn::ImplItemFn">ImplItemFn</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ImplItemMacro.html" title="struct syn::ImplItemMacro">ImplItemMacro</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ImplItemType.html" title="struct syn::ImplItemType">ImplItemType</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.Index.html" title="struct syn::Index">Index</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ItemConst.html" title="struct syn::ItemConst">ItemConst</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ItemEnum.html" title="struct syn::ItemEnum">ItemEnum</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ItemExternCrate.html" title="struct syn::ItemExternCrate">ItemExternCrate</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ItemFn.html" title="struct syn::ItemFn">ItemFn</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ItemForeignMod.html" title="struct syn::ItemForeignMod">ItemForeignMod</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ItemImpl.html" title="struct syn::ItemImpl">ItemImpl</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ItemMacro.html" title="struct syn::ItemMacro">ItemMacro</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ItemMod.html" title="struct syn::ItemMod">ItemMod</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ItemStatic.html" title="struct syn::ItemStatic">ItemStatic</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ItemStruct.html" title="struct syn::ItemStruct">ItemStruct</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ItemTrait.html" title="struct syn::ItemTrait">ItemTrait</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ItemTraitAlias.html" title="struct syn::ItemTraitAlias">ItemTraitAlias</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ItemType.html" title="struct syn::ItemType">ItemType</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ItemUnion.html" title="struct syn::ItemUnion">ItemUnion</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ItemUse.html" title="struct syn::ItemUse">ItemUse</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.Label.html" title="struct syn::Label">Label</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.Lifetime.html" title="struct syn::Lifetime">Lifetime</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.LifetimeParam.html" title="struct syn::LifetimeParam">LifetimeParam</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.LitBool.html" title="struct syn::LitBool">LitBool</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.LitByte.html" title="struct syn::LitByte">LitByte</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.LitByteStr.html" title="struct syn::LitByteStr">LitByteStr</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.LitCStr.html" title="struct syn::LitCStr">LitCStr</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.LitChar.html" title="struct syn::LitChar">LitChar</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.LitFloat.html" title="struct syn::LitFloat">LitFloat</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.LitInt.html" title="struct syn::LitInt">LitInt</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.LitStr.html" title="struct syn::LitStr">LitStr</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.Local.html" title="struct syn::Local">Local</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.LocalInit.html" title="struct syn::LocalInit">LocalInit</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.Macro.html" title="struct syn::Macro">Macro</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.MetaList.html" title="struct syn::MetaList">MetaList</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.MetaNameValue.html" title="struct syn::MetaNameValue">MetaNameValue</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ParenthesizedGenericArguments.html" title="struct syn::ParenthesizedGenericArguments">ParenthesizedGenericArguments</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.PatIdent.html" title="struct syn::PatIdent">PatIdent</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.PatOr.html" title="struct syn::PatOr">PatOr</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.PatParen.html" title="struct syn::PatParen">PatParen</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.PatReference.html" title="struct syn::PatReference">PatReference</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.PatRest.html" title="struct syn::PatRest">PatRest</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.PatSlice.html" title="struct syn::PatSlice">PatSlice</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.PatStruct.html" title="struct syn::PatStruct">PatStruct</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.PatTuple.html" title="struct syn::PatTuple">PatTuple</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.PatTupleStruct.html" title="struct syn::PatTupleStruct">PatTupleStruct</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.PatType.html" title="struct syn::PatType">PatType</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.PatWild.html" title="struct syn::PatWild">PatWild</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.Path.html" title="struct syn::Path">Path</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.PathSegment.html" title="struct syn::PathSegment">PathSegment</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.PreciseCapture.html" title="struct syn::PreciseCapture">PreciseCapture</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.PredicateLifetime.html" title="struct syn::PredicateLifetime">PredicateLifetime</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.PredicateType.html" title="struct syn::PredicateType">PredicateType</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.QSelf.html" title="struct syn::QSelf">QSelf</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.Receiver.html" title="struct syn::Receiver">Receiver</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.Signature.html" title="struct syn::Signature">Signature</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.StmtMacro.html" title="struct syn::StmtMacro">StmtMacro</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.TraitBound.html" title="struct syn::TraitBound">TraitBound</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.TraitItemConst.html" title="struct syn::TraitItemConst">TraitItemConst</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.TraitItemFn.html" title="struct syn::TraitItemFn">TraitItemFn</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.TraitItemMacro.html" title="struct syn::TraitItemMacro">TraitItemMacro</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.TraitItemType.html" title="struct syn::TraitItemType">TraitItemType</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.TypeArray.html" title="struct syn::TypeArray">TypeArray</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.TypeBareFn.html" title="struct syn::TypeBareFn">TypeBareFn</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.TypeGroup.html" title="struct syn::TypeGroup">TypeGroup</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.TypeImplTrait.html" title="struct syn::TypeImplTrait">TypeImplTrait</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.TypeInfer.html" title="struct syn::TypeInfer">TypeInfer</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.TypeMacro.html" title="struct syn::TypeMacro">TypeMacro</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.TypeNever.html" title="struct syn::TypeNever">TypeNever</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.TypeParam.html" title="struct syn::TypeParam">TypeParam</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.TypeParen.html" title="struct syn::TypeParen">TypeParen</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.TypePath.html" title="struct syn::TypePath">TypePath</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.TypePtr.html" title="struct syn::TypePtr">TypePtr</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.TypeReference.html" title="struct syn::TypeReference">TypeReference</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.TypeSlice.html" title="struct syn::TypeSlice">TypeSlice</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.TypeTraitObject.html" title="struct syn::TypeTraitObject">TypeTraitObject</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.TypeTuple.html" title="struct syn::TypeTuple">TypeTuple</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.UseGlob.html" title="struct syn::UseGlob">UseGlob</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.UseGroup.html" title="struct syn::UseGroup">UseGroup</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.UseName.html" title="struct syn::UseName">UseName</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.UsePath.html" title="struct syn::UsePath">UsePath</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.UseRename.html" title="struct syn::UseRename">UseRename</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.Variadic.html" title="struct syn::Variadic">Variadic</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.Variant.html" title="struct syn::Variant">Variant</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.VisRestricted.html" title="struct syn::VisRestricted">VisRestricted</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.WhereClause.html" title="struct syn::WhereClause">WhereClause</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Abstract.html" title="struct syn::token::Abstract">Abstract</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.And.html" title="struct syn::token::And">And</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.AndAnd.html" title="struct syn::token::AndAnd">AndAnd</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.AndEq.html" title="struct syn::token::AndEq">AndEq</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.As.html" title="struct syn::token::As">As</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Async.html" title="struct syn::token::Async">Async</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.At.html" title="struct syn::token::At">At</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Auto.html" title="struct syn::token::Auto">Auto</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Await.html" title="struct syn::token::Await">Await</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Become.html" title="struct syn::token::Become">Become</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Box.html" title="struct syn::token::Box">Box</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Brace.html" title="struct syn::token::Brace">Brace</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Bracket.html" title="struct syn::token::Bracket">Bracket</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Break.html" title="struct syn::token::Break">Break</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Caret.html" title="struct syn::token::Caret">Caret</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.CaretEq.html" title="struct syn::token::CaretEq">CaretEq</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Colon.html" title="struct syn::token::Colon">Colon</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Comma.html" title="struct syn::token::Comma">Comma</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Const.html" title="struct syn::token::Const">Const</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Continue.html" title="struct syn::token::Continue">Continue</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Crate.html" title="struct syn::token::Crate">Crate</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Default.html" title="struct syn::token::Default">Default</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Do.html" title="struct syn::token::Do">Do</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Dollar.html" title="struct syn::token::Dollar">Dollar</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Dot.html" title="struct syn::token::Dot">Dot</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.DotDot.html" title="struct syn::token::DotDot">DotDot</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.DotDotDot.html" title="struct syn::token::DotDotDot">DotDotDot</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.DotDotEq.html" title="struct syn::token::DotDotEq">DotDotEq</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Dyn.html" title="struct syn::token::Dyn">Dyn</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Else.html" title="struct syn::token::Else">Else</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Enum.html" title="struct syn::token::Enum">Enum</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Eq.html" title="struct syn::token::Eq">Eq</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.EqEq.html" title="struct syn::token::EqEq">EqEq</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Extern.html" title="struct syn::token::Extern">Extern</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.FatArrow.html" title="struct syn::token::FatArrow">FatArrow</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Final.html" title="struct syn::token::Final">Final</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Fn.html" title="struct syn::token::Fn">Fn</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.For.html" title="struct syn::token::For">For</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Ge.html" title="struct syn::token::Ge">Ge</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Group.html" title="struct syn::token::Group">Group</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Gt.html" title="struct syn::token::Gt">Gt</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.If.html" title="struct syn::token::If">If</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Impl.html" title="struct syn::token::Impl">Impl</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.In.html" title="struct syn::token::In">In</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.LArrow.html" title="struct syn::token::LArrow">LArrow</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Le.html" title="struct syn::token::Le">Le</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Let.html" title="struct syn::token::Let">Let</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Loop.html" title="struct syn::token::Loop">Loop</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Lt.html" title="struct syn::token::Lt">Lt</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Macro.html" title="struct syn::token::Macro">Macro</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Match.html" title="struct syn::token::Match">Match</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Minus.html" title="struct syn::token::Minus">Minus</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.MinusEq.html" title="struct syn::token::MinusEq">MinusEq</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Mod.html" title="struct syn::token::Mod">Mod</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Move.html" title="struct syn::token::Move">Move</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Mut.html" title="struct syn::token::Mut">Mut</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Ne.html" title="struct syn::token::Ne">Ne</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Not.html" title="struct syn::token::Not">Not</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Or.html" title="struct syn::token::Or">Or</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.OrEq.html" title="struct syn::token::OrEq">OrEq</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.OrOr.html" title="struct syn::token::OrOr">OrOr</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Override.html" title="struct syn::token::Override">Override</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Paren.html" title="struct syn::token::Paren">Paren</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.PathSep.html" title="struct syn::token::PathSep">PathSep</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Percent.html" title="struct syn::token::Percent">Percent</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.PercentEq.html" title="struct syn::token::PercentEq">PercentEq</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Plus.html" title="struct syn::token::Plus">Plus</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.PlusEq.html" title="struct syn::token::PlusEq">PlusEq</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Pound.html" title="struct syn::token::Pound">Pound</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Priv.html" title="struct syn::token::Priv">Priv</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Pub.html" title="struct syn::token::Pub">Pub</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Question.html" title="struct syn::token::Question">Question</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.RArrow.html" title="struct syn::token::RArrow">RArrow</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Raw.html" title="struct syn::token::Raw">Raw</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Ref.html" title="struct syn::token::Ref">Ref</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Return.html" title="struct syn::token::Return">Return</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.SelfType.html" title="struct syn::token::SelfType">SelfType</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.SelfValue.html" title="struct syn::token::SelfValue">SelfValue</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Semi.html" title="struct syn::token::Semi">Semi</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Shl.html" title="struct syn::token::Shl">Shl</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.ShlEq.html" title="struct syn::token::ShlEq">ShlEq</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Shr.html" title="struct syn::token::Shr">Shr</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.ShrEq.html" title="struct syn::token::ShrEq">ShrEq</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Slash.html" title="struct syn::token::Slash">Slash</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.SlashEq.html" title="struct syn::token::SlashEq">SlashEq</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Star.html" title="struct syn::token::Star">Star</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.StarEq.html" title="struct syn::token::StarEq">StarEq</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Static.html" title="struct syn::token::Static">Static</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Struct.html" title="struct syn::token::Struct">Struct</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Super.html" title="struct syn::token::Super">Super</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Tilde.html" title="struct syn::token::Tilde">Tilde</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Trait.html" title="struct syn::token::Trait">Trait</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Try.html" title="struct syn::token::Try">Try</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Type.html" title="struct syn::token::Type">Type</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Typeof.html" title="struct syn::token::Typeof">Typeof</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Underscore.html" title="struct syn::token::Underscore">Underscore</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Union.html" title="struct syn::token::Union">Union</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Unsafe.html" title="struct syn::token::Unsafe">Unsafe</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Unsized.html" title="struct syn::token::Unsized">Unsized</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Use.html" title="struct syn::token::Use">Use</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Virtual.html" title="struct syn::token::Virtual">Virtual</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Where.html" title="struct syn::token::Where">Where</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.While.html" title="struct syn::token::While">While</a>',
        ],
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/token/struct.Yield.html" title="struct syn::token::Yield">Yield</a>',
        ],
        [
          'impl&lt;\'a&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/buffer/struct.Cursor.html" title="struct syn::buffer::Cursor">Cursor</a>&lt;\'a&gt;',
        ],
        [
          'impl&lt;\'a&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.ImplGenerics.html" title="struct syn::ImplGenerics">ImplGenerics</a>&lt;\'a&gt;',
        ],
        [
          'impl&lt;\'a&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.Turbofish.html" title="struct syn::Turbofish">Turbofish</a>&lt;\'a&gt;',
        ],
        [
          'impl&lt;\'a&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/struct.TypeGenerics.html" title="struct syn::TypeGenerics">TypeGenerics</a>&lt;\'a&gt;',
        ],
        [
          'impl&lt;\'a, T&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/punctuated/struct.Iter.html" title="struct syn::punctuated::Iter">Iter</a>&lt;\'a, T&gt;',
        ],
        [
          'impl&lt;\'a, T, P&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/punctuated/struct.Pairs.html" title="struct syn::punctuated::Pairs">Pairs</a>&lt;\'a, T, P&gt;',
        ],
        [
          'impl&lt;\'c, \'a&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/parse/struct.StepCursor.html" title="struct syn::parse::StepCursor">StepCursor</a>&lt;\'c, \'a&gt;',
        ],
        [
          'impl&lt;T&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/punctuated/struct.IntoIter.html" title="struct syn::punctuated::IntoIter">IntoIter</a>&lt;T&gt;<div class="where">where\n    T: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>,</div>',
        ],
        [
          'impl&lt;T, P&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="enum" href="syn/punctuated/enum.Pair.html" title="enum syn::punctuated::Pair">Pair</a>&lt;T, P&gt;<div class="where">where\n    T: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>,\n    P: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>,</div>',
        ],
        [
          'impl&lt;T, P&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/punctuated/struct.IntoPairs.html" title="struct syn::punctuated::IntoPairs">IntoPairs</a>&lt;T, P&gt;<div class="where">where\n    T: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>,\n    P: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>,</div>',
        ],
        [
          'impl&lt;T, P&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="syn/punctuated/struct.Punctuated.html" title="struct syn::punctuated::Punctuated">Punctuated</a>&lt;T, P&gt;<div class="where">where\n    T: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>,\n    P: <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a>,</div>',
        ],
      ],
    ],
    [
      'unicode_segmentation',
      [
        [
          'impl <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="unicode_segmentation/struct.GraphemeCursor.html" title="struct unicode_segmentation::GraphemeCursor">GraphemeCursor</a>',
        ],
        [
          'impl&lt;\'a&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="unicode_segmentation/struct.GraphemeIndices.html" title="struct unicode_segmentation::GraphemeIndices">GraphemeIndices</a>&lt;\'a&gt;',
        ],
        [
          'impl&lt;\'a&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="unicode_segmentation/struct.Graphemes.html" title="struct unicode_segmentation::Graphemes">Graphemes</a>&lt;\'a&gt;',
        ],
        [
          'impl&lt;\'a&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="unicode_segmentation/struct.USentenceBoundIndices.html" title="struct unicode_segmentation::USentenceBoundIndices">USentenceBoundIndices</a>&lt;\'a&gt;',
        ],
        [
          'impl&lt;\'a&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="unicode_segmentation/struct.USentenceBounds.html" title="struct unicode_segmentation::USentenceBounds">USentenceBounds</a>&lt;\'a&gt;',
        ],
        [
          'impl&lt;\'a&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="unicode_segmentation/struct.UWordBoundIndices.html" title="struct unicode_segmentation::UWordBoundIndices">UWordBoundIndices</a>&lt;\'a&gt;',
        ],
        [
          'impl&lt;\'a&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="unicode_segmentation/struct.UWordBounds.html" title="struct unicode_segmentation::UWordBounds">UWordBounds</a>&lt;\'a&gt;',
        ],
        [
          'impl&lt;\'a&gt; <a class="trait" href="https://doc.rust-lang.org/nightly/core/clone/trait.Clone.html" title="trait core::clone::Clone">Clone</a> for <a class="struct" href="unicode_segmentation/struct.UnicodeSentences.html" title="struct unicode_segmentation::UnicodeSentences">UnicodeSentences</a>&lt;\'a&gt;',
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
//{"start":57,"fragment_lengths":[8041,778,289,253,8215,66543,4391,4838,1286,2895,1448,6310,21889,19764,250,1531,11319,1881,77151,2569]}
