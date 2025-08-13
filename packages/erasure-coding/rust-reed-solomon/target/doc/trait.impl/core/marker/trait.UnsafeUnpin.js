;(() => {
  var implementors = Object.fromEntries([
    [
      'aho_corasick',
      [
        [
          'impl UnsafeUnpin for <a class="enum" href="aho_corasick/automaton/enum.Candidate.html" title="enum aho_corasick::automaton::Candidate">Candidate</a>',
          1,
          ['aho_corasick::util::prefilter::Candidate'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="aho_corasick/enum.AhoCorasickKind.html" title="enum aho_corasick::AhoCorasickKind">AhoCorasickKind</a>',
          1,
          ['aho_corasick::ahocorasick::AhoCorasickKind'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="aho_corasick/enum.Anchored.html" title="enum aho_corasick::Anchored">Anchored</a>',
          1,
          ['aho_corasick::util::search::Anchored'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="aho_corasick/enum.MatchErrorKind.html" title="enum aho_corasick::MatchErrorKind">MatchErrorKind</a>',
          1,
          ['aho_corasick::util::error::MatchErrorKind'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="aho_corasick/enum.MatchKind.html" title="enum aho_corasick::MatchKind">MatchKind</a>',
          1,
          ['aho_corasick::util::search::MatchKind'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="aho_corasick/enum.StartKind.html" title="enum aho_corasick::StartKind">StartKind</a>',
          1,
          ['aho_corasick::util::search::StartKind'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="aho_corasick/packed/enum.MatchKind.html" title="enum aho_corasick::packed::MatchKind">MatchKind</a>',
          1,
          ['aho_corasick::packed::api::MatchKind'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="aho_corasick/automaton/struct.OverlappingState.html" title="struct aho_corasick::automaton::OverlappingState">OverlappingState</a>',
          1,
          ['aho_corasick::automaton::OverlappingState'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="aho_corasick/automaton/struct.Prefilter.html" title="struct aho_corasick::automaton::Prefilter">Prefilter</a>',
          1,
          ['aho_corasick::util::prefilter::Prefilter'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="aho_corasick/automaton/struct.StateID.html" title="struct aho_corasick::automaton::StateID">StateID</a>',
          1,
          ['aho_corasick::util::primitives::StateID'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="aho_corasick/automaton/struct.StateIDError.html" title="struct aho_corasick::automaton::StateIDError">StateIDError</a>',
          1,
          ['aho_corasick::util::primitives::StateIDError'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="aho_corasick/dfa/struct.Builder.html" title="struct aho_corasick::dfa::Builder">Builder</a>',
          1,
          ['aho_corasick::dfa::Builder'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="aho_corasick/dfa/struct.DFA.html" title="struct aho_corasick::dfa::DFA">DFA</a>',
          1,
          ['aho_corasick::dfa::DFA'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="aho_corasick/nfa/contiguous/struct.Builder.html" title="struct aho_corasick::nfa::contiguous::Builder">Builder</a>',
          1,
          ['aho_corasick::nfa::contiguous::Builder'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="aho_corasick/nfa/contiguous/struct.NFA.html" title="struct aho_corasick::nfa::contiguous::NFA">NFA</a>',
          1,
          ['aho_corasick::nfa::contiguous::NFA'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="aho_corasick/nfa/noncontiguous/struct.Builder.html" title="struct aho_corasick::nfa::noncontiguous::Builder">Builder</a>',
          1,
          ['aho_corasick::nfa::noncontiguous::Builder'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="aho_corasick/nfa/noncontiguous/struct.NFA.html" title="struct aho_corasick::nfa::noncontiguous::NFA">NFA</a>',
          1,
          ['aho_corasick::nfa::noncontiguous::NFA'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="aho_corasick/packed/struct.Builder.html" title="struct aho_corasick::packed::Builder">Builder</a>',
          1,
          ['aho_corasick::packed::api::Builder'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="aho_corasick/packed/struct.Config.html" title="struct aho_corasick::packed::Config">Config</a>',
          1,
          ['aho_corasick::packed::api::Config'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="aho_corasick/packed/struct.Searcher.html" title="struct aho_corasick::packed::Searcher">Searcher</a>',
          1,
          ['aho_corasick::packed::api::Searcher'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="aho_corasick/struct.AhoCorasick.html" title="struct aho_corasick::AhoCorasick">AhoCorasick</a>',
          1,
          ['aho_corasick::ahocorasick::AhoCorasick'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="aho_corasick/struct.AhoCorasickBuilder.html" title="struct aho_corasick::AhoCorasickBuilder">AhoCorasickBuilder</a>',
          1,
          ['aho_corasick::ahocorasick::AhoCorasickBuilder'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="aho_corasick/struct.BuildError.html" title="struct aho_corasick::BuildError">BuildError</a>',
          1,
          ['aho_corasick::util::error::BuildError'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="aho_corasick/struct.Match.html" title="struct aho_corasick::Match">Match</a>',
          1,
          ['aho_corasick::util::search::Match'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="aho_corasick/struct.MatchError.html" title="struct aho_corasick::MatchError">MatchError</a>',
          1,
          ['aho_corasick::util::error::MatchError'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="aho_corasick/struct.PatternID.html" title="struct aho_corasick::PatternID">PatternID</a>',
          1,
          ['aho_corasick::util::primitives::PatternID'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="aho_corasick/struct.PatternIDError.html" title="struct aho_corasick::PatternIDError">PatternIDError</a>',
          1,
          ['aho_corasick::util::primitives::PatternIDError'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="aho_corasick/struct.Span.html" title="struct aho_corasick::Span">Span</a>',
          1,
          ['aho_corasick::util::search::Span'],
        ],
        [
          'impl&lt;\'a, \'h&gt; UnsafeUnpin for <a class="struct" href="aho_corasick/struct.FindIter.html" title="struct aho_corasick::FindIter">FindIter</a>&lt;\'a, \'h&gt;',
          1,
          ['aho_corasick::ahocorasick::FindIter'],
        ],
        [
          'impl&lt;\'a, \'h&gt; UnsafeUnpin for <a class="struct" href="aho_corasick/struct.FindOverlappingIter.html" title="struct aho_corasick::FindOverlappingIter">FindOverlappingIter</a>&lt;\'a, \'h&gt;',
          1,
          ['aho_corasick::ahocorasick::FindOverlappingIter'],
        ],
        [
          'impl&lt;\'a, \'h, A&gt; UnsafeUnpin for <a class="struct" href="aho_corasick/automaton/struct.FindIter.html" title="struct aho_corasick::automaton::FindIter">FindIter</a>&lt;\'a, \'h, A&gt;',
          1,
          ['aho_corasick::automaton::FindIter'],
        ],
        [
          'impl&lt;\'a, \'h, A&gt; UnsafeUnpin for <a class="struct" href="aho_corasick/automaton/struct.FindOverlappingIter.html" title="struct aho_corasick::automaton::FindOverlappingIter">FindOverlappingIter</a>&lt;\'a, \'h, A&gt;',
          1,
          ['aho_corasick::automaton::FindOverlappingIter'],
        ],
        [
          'impl&lt;\'a, A, R&gt; UnsafeUnpin for <a class="struct" href="aho_corasick/automaton/struct.StreamFindIter.html" title="struct aho_corasick::automaton::StreamFindIter">StreamFindIter</a>&lt;\'a, A, R&gt;<div class="where">where\n    R: UnsafeUnpin,</div>',
          1,
          ['aho_corasick::automaton::StreamFindIter'],
        ],
        [
          'impl&lt;\'a, R&gt; UnsafeUnpin for <a class="struct" href="aho_corasick/struct.StreamFindIter.html" title="struct aho_corasick::StreamFindIter">StreamFindIter</a>&lt;\'a, R&gt;<div class="where">where\n    R: UnsafeUnpin,</div>',
          1,
          ['aho_corasick::ahocorasick::StreamFindIter'],
        ],
        [
          'impl&lt;\'h&gt; UnsafeUnpin for <a class="struct" href="aho_corasick/struct.Input.html" title="struct aho_corasick::Input">Input</a>&lt;\'h&gt;',
          1,
          ['aho_corasick::util::search::Input'],
        ],
        [
          'impl&lt;\'s, \'h&gt; UnsafeUnpin for <a class="struct" href="aho_corasick/packed/struct.FindIter.html" title="struct aho_corasick::packed::FindIter">FindIter</a>&lt;\'s, \'h&gt;',
          1,
          ['aho_corasick::packed::api::FindIter'],
        ],
      ],
    ],
    [
      'bitflags',
      [
        [
          'impl UnsafeUnpin for <a class="struct" href="bitflags/parser/struct.ParseError.html" title="struct bitflags::parser::ParseError">ParseError</a>',
          1,
          ['bitflags::parser::ParseError'],
        ],
        [
          'impl&lt;B&gt; UnsafeUnpin for <a class="struct" href="bitflags/iter/struct.Iter.html" title="struct bitflags::iter::Iter">Iter</a>&lt;B&gt;<div class="where">where\n    B: UnsafeUnpin,</div>',
          1,
          ['bitflags::iter::Iter'],
        ],
        [
          'impl&lt;B&gt; UnsafeUnpin for <a class="struct" href="bitflags/iter/struct.IterNames.html" title="struct bitflags::iter::IterNames">IterNames</a>&lt;B&gt;<div class="where">where\n    B: UnsafeUnpin,</div>',
          1,
          ['bitflags::iter::IterNames'],
        ],
        [
          'impl&lt;B&gt; UnsafeUnpin for <a class="struct" href="bitflags/struct.Flag.html" title="struct bitflags::Flag">Flag</a>&lt;B&gt;<div class="where">where\n    B: UnsafeUnpin,</div>',
          1,
          ['bitflags::traits::Flag'],
        ],
      ],
    ],
    [
      'convert_case',
      [
        [
          'impl UnsafeUnpin for <a class="enum" href="convert_case/enum.Boundary.html" title="enum convert_case::Boundary">Boundary</a>',
          1,
          ['convert_case::segmentation::Boundary'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="convert_case/enum.Case.html" title="enum convert_case::Case">Case</a>',
          1,
          ['convert_case::case::Case'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="convert_case/enum.Pattern.html" title="enum convert_case::Pattern">Pattern</a>',
          1,
          ['convert_case::pattern::Pattern'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="convert_case/struct.Converter.html" title="struct convert_case::Converter">Converter</a>',
          1,
          ['convert_case::converter::Converter'],
        ],
        [
          'impl&lt;\'a, T&gt; UnsafeUnpin for <a class="struct" href="convert_case/struct.StateConverter.html" title="struct convert_case::StateConverter">StateConverter</a>&lt;\'a, T&gt;',
          1,
          ['convert_case::StateConverter'],
        ],
      ],
    ],
    [
      'fixedbitset',
      [
        [
          'impl UnsafeUnpin for <a class="struct" href="fixedbitset/struct.FixedBitSet.html" title="struct fixedbitset::FixedBitSet">FixedBitSet</a>',
          1,
          ['fixedbitset::FixedBitSet'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="fixedbitset/struct.Difference.html" title="struct fixedbitset::Difference">Difference</a>&lt;\'a&gt;',
          1,
          ['fixedbitset::Difference'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="fixedbitset/struct.Intersection.html" title="struct fixedbitset::Intersection">Intersection</a>&lt;\'a&gt;',
          1,
          ['fixedbitset::Intersection'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="fixedbitset/struct.Ones.html" title="struct fixedbitset::Ones">Ones</a>&lt;\'a&gt;',
          1,
          ['fixedbitset::Ones'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="fixedbitset/struct.SymmetricDifference.html" title="struct fixedbitset::SymmetricDifference">SymmetricDifference</a>&lt;\'a&gt;',
          1,
          ['fixedbitset::SymmetricDifference'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="fixedbitset/struct.Union.html" title="struct fixedbitset::Union">Union</a>&lt;\'a&gt;',
          1,
          ['fixedbitset::Union'],
        ],
      ],
    ],
    [
      'itoa',
      [
        [
          'impl UnsafeUnpin for <a class="struct" href="itoa/struct.Buffer.html" title="struct itoa::Buffer">Buffer</a>',
          1,
          ['itoa::Buffer'],
        ],
      ],
    ],
    [
      'jam_reed_solomon',
      [
        [
          'impl UnsafeUnpin for <a class="struct" href="jam_reed_solomon/struct.EncodedResult.html" title="struct jam_reed_solomon::EncodedResult">EncodedResult</a>',
          1,
          ['jam_reed_solomon::EncodedResult'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="jam_reed_solomon/struct.RustReedSolomon.html" title="struct jam_reed_solomon::RustReedSolomon">RustReedSolomon</a>',
          1,
          ['jam_reed_solomon::RustReedSolomon'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="jam_reed_solomon/struct.ValidationResult.html" title="struct jam_reed_solomon::ValidationResult">ValidationResult</a>',
          1,
          ['jam_reed_solomon::ValidationResult'],
        ],
      ],
    ],
    [
      'memchr',
      [
        [
          'impl UnsafeUnpin for <a class="enum" href="memchr/memmem/enum.Prefilter.html" title="enum memchr::memmem::Prefilter">PrefilterConfig</a>',
          1,
          ['memchr::memmem::searcher::PrefilterConfig'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="memchr/arch/aarch64/neon/memchr/struct.One.html" title="struct memchr::arch::aarch64::neon::memchr::One">One</a>',
          1,
          ['memchr::arch::aarch64::neon::memchr::One'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="memchr/arch/aarch64/neon/memchr/struct.Three.html" title="struct memchr::arch::aarch64::neon::memchr::Three">Three</a>',
          1,
          ['memchr::arch::aarch64::neon::memchr::Three'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="memchr/arch/aarch64/neon/memchr/struct.Two.html" title="struct memchr::arch::aarch64::neon::memchr::Two">Two</a>',
          1,
          ['memchr::arch::aarch64::neon::memchr::Two'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="memchr/arch/aarch64/neon/packedpair/struct.Finder.html" title="struct memchr::arch::aarch64::neon::packedpair::Finder">Finder</a>',
          1,
          ['memchr::arch::aarch64::neon::packedpair::Finder'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="memchr/arch/all/memchr/struct.One.html" title="struct memchr::arch::all::memchr::One">One</a>',
          1,
          ['memchr::arch::all::memchr::One'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="memchr/arch/all/memchr/struct.Three.html" title="struct memchr::arch::all::memchr::Three">Three</a>',
          1,
          ['memchr::arch::all::memchr::Three'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="memchr/arch/all/memchr/struct.Two.html" title="struct memchr::arch::all::memchr::Two">Two</a>',
          1,
          ['memchr::arch::all::memchr::Two'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="memchr/arch/all/packedpair/struct.Finder.html" title="struct memchr::arch::all::packedpair::Finder">Finder</a>',
          1,
          ['memchr::arch::all::packedpair::Finder'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="memchr/arch/all/packedpair/struct.Pair.html" title="struct memchr::arch::all::packedpair::Pair">Pair</a>',
          1,
          ['memchr::arch::all::packedpair::Pair'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="memchr/arch/all/rabinkarp/struct.Finder.html" title="struct memchr::arch::all::rabinkarp::Finder">Finder</a>',
          1,
          ['memchr::arch::all::rabinkarp::Finder'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="memchr/arch/all/rabinkarp/struct.FinderRev.html" title="struct memchr::arch::all::rabinkarp::FinderRev">FinderRev</a>',
          1,
          ['memchr::arch::all::rabinkarp::FinderRev'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="memchr/arch/all/shiftor/struct.Finder.html" title="struct memchr::arch::all::shiftor::Finder">Finder</a>',
          1,
          ['memchr::arch::all::shiftor::Finder'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="memchr/arch/all/twoway/struct.Finder.html" title="struct memchr::arch::all::twoway::Finder">Finder</a>',
          1,
          ['memchr::arch::all::twoway::Finder'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="memchr/arch/all/twoway/struct.FinderRev.html" title="struct memchr::arch::all::twoway::FinderRev">FinderRev</a>',
          1,
          ['memchr::arch::all::twoway::FinderRev'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="memchr/memmem/struct.FinderBuilder.html" title="struct memchr::memmem::FinderBuilder">FinderBuilder</a>',
          1,
          ['memchr::memmem::FinderBuilder'],
        ],
        [
          'impl&lt;\'a, \'h&gt; UnsafeUnpin for <a class="struct" href="memchr/arch/aarch64/neon/memchr/struct.OneIter.html" title="struct memchr::arch::aarch64::neon::memchr::OneIter">OneIter</a>&lt;\'a, \'h&gt;',
          1,
          ['memchr::arch::aarch64::neon::memchr::OneIter'],
        ],
        [
          'impl&lt;\'a, \'h&gt; UnsafeUnpin for <a class="struct" href="memchr/arch/aarch64/neon/memchr/struct.ThreeIter.html" title="struct memchr::arch::aarch64::neon::memchr::ThreeIter">ThreeIter</a>&lt;\'a, \'h&gt;',
          1,
          ['memchr::arch::aarch64::neon::memchr::ThreeIter'],
        ],
        [
          'impl&lt;\'a, \'h&gt; UnsafeUnpin for <a class="struct" href="memchr/arch/aarch64/neon/memchr/struct.TwoIter.html" title="struct memchr::arch::aarch64::neon::memchr::TwoIter">TwoIter</a>&lt;\'a, \'h&gt;',
          1,
          ['memchr::arch::aarch64::neon::memchr::TwoIter'],
        ],
        [
          'impl&lt;\'a, \'h&gt; UnsafeUnpin for <a class="struct" href="memchr/arch/all/memchr/struct.OneIter.html" title="struct memchr::arch::all::memchr::OneIter">OneIter</a>&lt;\'a, \'h&gt;',
          1,
          ['memchr::arch::all::memchr::OneIter'],
        ],
        [
          'impl&lt;\'a, \'h&gt; UnsafeUnpin for <a class="struct" href="memchr/arch/all/memchr/struct.ThreeIter.html" title="struct memchr::arch::all::memchr::ThreeIter">ThreeIter</a>&lt;\'a, \'h&gt;',
          1,
          ['memchr::arch::all::memchr::ThreeIter'],
        ],
        [
          'impl&lt;\'a, \'h&gt; UnsafeUnpin for <a class="struct" href="memchr/arch/all/memchr/struct.TwoIter.html" title="struct memchr::arch::all::memchr::TwoIter">TwoIter</a>&lt;\'a, \'h&gt;',
          1,
          ['memchr::arch::all::memchr::TwoIter'],
        ],
        [
          'impl&lt;\'h&gt; UnsafeUnpin for <a class="struct" href="memchr/struct.Memchr.html" title="struct memchr::Memchr">Memchr</a>&lt;\'h&gt;',
          1,
          ['memchr::memchr::Memchr'],
        ],
        [
          'impl&lt;\'h&gt; UnsafeUnpin for <a class="struct" href="memchr/struct.Memchr2.html" title="struct memchr::Memchr2">Memchr2</a>&lt;\'h&gt;',
          1,
          ['memchr::memchr::Memchr2'],
        ],
        [
          'impl&lt;\'h&gt; UnsafeUnpin for <a class="struct" href="memchr/struct.Memchr3.html" title="struct memchr::Memchr3">Memchr3</a>&lt;\'h&gt;',
          1,
          ['memchr::memchr::Memchr3'],
        ],
        [
          'impl&lt;\'h, \'n&gt; UnsafeUnpin for <a class="struct" href="memchr/memmem/struct.FindIter.html" title="struct memchr::memmem::FindIter">FindIter</a>&lt;\'h, \'n&gt;',
          1,
          ['memchr::memmem::FindIter'],
        ],
        [
          'impl&lt;\'h, \'n&gt; UnsafeUnpin for <a class="struct" href="memchr/memmem/struct.FindRevIter.html" title="struct memchr::memmem::FindRevIter">FindRevIter</a>&lt;\'h, \'n&gt;',
          1,
          ['memchr::memmem::FindRevIter'],
        ],
        [
          'impl&lt;\'n&gt; UnsafeUnpin for <a class="struct" href="memchr/memmem/struct.Finder.html" title="struct memchr::memmem::Finder">Finder</a>&lt;\'n&gt;',
          1,
          ['memchr::memmem::Finder'],
        ],
        [
          'impl&lt;\'n&gt; UnsafeUnpin for <a class="struct" href="memchr/memmem/struct.FinderRev.html" title="struct memchr::memmem::FinderRev">FinderRev</a>&lt;\'n&gt;',
          1,
          ['memchr::memmem::FinderRev'],
        ],
      ],
    ],
    [
      'napi',
      [
        [
          'impl UnsafeUnpin for <a class="enum" href="napi/enum.Status.html" title="enum napi::Status">Status</a>',
          1,
          ['napi::status::Status'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="napi/enum.TypedArrayType.html" title="enum napi::TypedArrayType">TypedArrayType</a>',
          1,
          ['napi::js_values::arraybuffer::TypedArrayType'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="napi/enum.ValueType.html" title="enum napi::ValueType">ValueType</a>',
          1,
          ['napi::value_type::ValueType'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="napi/threadsafe_function/ErrorStrategy/enum.CalleeHandled.html" title="enum napi::threadsafe_function::ErrorStrategy::CalleeHandled">CalleeHandled</a>',
          1,
          ['napi::threadsafe_function::ErrorStrategy::CalleeHandled'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="napi/threadsafe_function/ErrorStrategy/enum.Fatal.html" title="enum napi::threadsafe_function::ErrorStrategy::Fatal">Fatal</a>',
          1,
          ['napi::threadsafe_function::ErrorStrategy::Fatal'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="napi/threadsafe_function/enum.ThreadsafeFunctionCallMode.html" title="enum napi::threadsafe_function::ThreadsafeFunctionCallMode">ThreadsafeFunctionCallMode</a>',
          1,
          ['napi::threadsafe_function::ThreadsafeFunctionCallMode'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/bindgen_prelude/struct.AbortSignal.html" title="struct napi::bindgen_prelude::AbortSignal">AbortSignal</a>',
          1,
          ['napi::bindgen_runtime::js_values::task::AbortSignal'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/bindgen_prelude/struct.Array.html" title="struct napi::bindgen_prelude::Array">Array</a>',
          1,
          ['napi::bindgen_runtime::js_values::array::Array'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/bindgen_prelude/struct.Buffer.html" title="struct napi::bindgen_prelude::Buffer">Buffer</a>',
          1,
          ['napi::bindgen_runtime::js_values::buffer::Buffer'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/bindgen_prelude/struct.Float32Array.html" title="struct napi::bindgen_prelude::Float32Array">Float32Array</a>',
          1,
          ['napi::bindgen_runtime::js_values::arraybuffer::Float32Array'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/bindgen_prelude/struct.Float64Array.html" title="struct napi::bindgen_prelude::Float64Array">Float64Array</a>',
          1,
          ['napi::bindgen_runtime::js_values::arraybuffer::Float64Array'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/bindgen_prelude/struct.Int16Array.html" title="struct napi::bindgen_prelude::Int16Array">Int16Array</a>',
          1,
          ['napi::bindgen_runtime::js_values::arraybuffer::Int16Array'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/bindgen_prelude/struct.Int32Array.html" title="struct napi::bindgen_prelude::Int32Array">Int32Array</a>',
          1,
          ['napi::bindgen_runtime::js_values::arraybuffer::Int32Array'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/bindgen_prelude/struct.Int8Array.html" title="struct napi::bindgen_prelude::Int8Array">Int8Array</a>',
          1,
          ['napi::bindgen_runtime::js_values::arraybuffer::Int8Array'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/bindgen_prelude/struct.Null.html" title="struct napi::bindgen_prelude::Null">Null</a>',
          1,
          ['napi::bindgen_runtime::js_values::nil::Null'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/bindgen_prelude/struct.Symbol.html" title="struct napi::bindgen_prelude::Symbol">Symbol</a>',
          1,
          ['napi::bindgen_runtime::js_values::symbol::Symbol'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/bindgen_prelude/struct.Uint16Array.html" title="struct napi::bindgen_prelude::Uint16Array">Uint16Array</a>',
          1,
          ['napi::bindgen_runtime::js_values::arraybuffer::Uint16Array'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/bindgen_prelude/struct.Uint32Array.html" title="struct napi::bindgen_prelude::Uint32Array">Uint32Array</a>',
          1,
          ['napi::bindgen_runtime::js_values::arraybuffer::Uint32Array'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/bindgen_prelude/struct.Uint8Array.html" title="struct napi::bindgen_prelude::Uint8Array">Uint8Array</a>',
          1,
          ['napi::bindgen_runtime::js_values::arraybuffer::Uint8Array'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/bindgen_prelude/struct.Uint8ClampedArray.html" title="struct napi::bindgen_prelude::Uint8ClampedArray">Uint8ClampedArray</a>',
          1,
          ['napi::bindgen_runtime::js_values::arraybuffer::Uint8ClampedArray'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/bindgen_prelude/struct.Utf16String.html" title="struct napi::bindgen_prelude::Utf16String">Utf16String</a>',
          1,
          ['napi::bindgen_runtime::js_values::string::Utf16String'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/struct.AsyncWorkPromise.html" title="struct napi::AsyncWorkPromise">AsyncWorkPromise</a>',
          1,
          ['napi::async_work::AsyncWorkPromise'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/struct.Env.html" title="struct napi::Env">Env</a>',
          1,
          ['napi::env::Env'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/struct.ExtendedErrorInfo.html" title="struct napi::ExtendedErrorInfo">ExtendedErrorInfo</a>',
          1,
          ['napi::error::ExtendedErrorInfo'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/struct.JSON.html" title="struct napi::JSON">JSON</a>',
          1,
          ['napi::js_values::global::JSON'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/struct.JsArrayBuffer.html" title="struct napi::JsArrayBuffer">JsArrayBuffer</a>',
          1,
          ['napi::js_values::arraybuffer::JsArrayBuffer'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/struct.JsArrayBufferValue.html" title="struct napi::JsArrayBufferValue">JsArrayBufferValue</a>',
          1,
          ['napi::js_values::arraybuffer::JsArrayBufferValue'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/struct.JsBoolean.html" title="struct napi::JsBoolean">JsBoolean</a>',
          1,
          ['napi::js_values::boolean::JsBoolean'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/struct.JsBuffer.html" title="struct napi::JsBuffer">JsBuffer</a>',
          1,
          ['napi::js_values::buffer::JsBuffer'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/struct.JsBufferValue.html" title="struct napi::JsBufferValue">JsBufferValue</a>',
          1,
          ['napi::js_values::buffer::JsBufferValue'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/struct.JsDataView.html" title="struct napi::JsDataView">JsDataView</a>',
          1,
          ['napi::js_values::arraybuffer::JsDataView'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/struct.JsDataViewValue.html" title="struct napi::JsDataViewValue">JsDataViewValue</a>',
          1,
          ['napi::js_values::arraybuffer::JsDataViewValue'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/struct.JsExternal.html" title="struct napi::JsExternal">JsExternal</a>',
          1,
          ['napi::js_values::JsExternal'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/struct.JsFunction.html" title="struct napi::JsFunction">JsFunction</a>',
          1,
          ['napi::js_values::function::JsFunction'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/struct.JsGlobal.html" title="struct napi::JsGlobal">JsGlobal</a>',
          1,
          ['napi::js_values::global::JsGlobal'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/struct.JsNull.html" title="struct napi::JsNull">JsNull</a>',
          1,
          ['napi::js_values::JsNull'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/struct.JsNumber.html" title="struct napi::JsNumber">JsNumber</a>',
          1,
          ['napi::js_values::number::JsNumber'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/struct.JsObject.html" title="struct napi::JsObject">JsObject</a>',
          1,
          ['napi::js_values::object::JsObject'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/struct.JsString.html" title="struct napi::JsString">JsString</a>',
          1,
          ['napi::js_values::string::JsString'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/struct.JsStringLatin1.html" title="struct napi::JsStringLatin1">JsStringLatin1</a>',
          1,
          ['napi::js_values::string::latin1::JsStringLatin1'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/struct.JsStringUtf16.html" title="struct napi::JsStringUtf16">JsStringUtf16</a>',
          1,
          ['napi::js_values::string::utf16::JsStringUtf16'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/struct.JsStringUtf8.html" title="struct napi::JsStringUtf8">JsStringUtf8</a>',
          1,
          ['napi::js_values::string::utf8::JsStringUtf8'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/struct.JsSymbol.html" title="struct napi::JsSymbol">JsSymbol</a>',
          1,
          ['napi::js_values::JsSymbol'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/struct.JsTimeout.html" title="struct napi::JsTimeout">JsTimeout</a>',
          1,
          ['napi::js_values::global::JsTimeout'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/struct.JsTypedArray.html" title="struct napi::JsTypedArray">JsTypedArray</a>',
          1,
          ['napi::js_values::arraybuffer::JsTypedArray'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/struct.JsTypedArrayValue.html" title="struct napi::JsTypedArrayValue">JsTypedArrayValue</a>',
          1,
          ['napi::js_values::arraybuffer::JsTypedArrayValue'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/struct.JsUndefined.html" title="struct napi::JsUndefined">JsUndefined</a>',
          1,
          ['napi::js_values::undefined::JsUndefined'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/struct.JsUnknown.html" title="struct napi::JsUnknown">JsUnknown</a>',
          1,
          ['napi::js_values::JsUnknown'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/struct.NodeVersion.html" title="struct napi::NodeVersion">NodeVersion</a>',
          1,
          ['napi::version::NodeVersion'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/struct.Property.html" title="struct napi::Property">Property</a>',
          1,
          ['napi::js_values::object_property::Property'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/struct.PropertyAttributes.html" title="struct napi::PropertyAttributes">PropertyAttributes</a>',
          1,
          ['napi::js_values::object_property::PropertyAttributes'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi/threadsafe_function/struct.UnknownReturnValue.html" title="struct napi::threadsafe_function::UnknownReturnValue">UnknownReturnValue</a>',
          1,
          ['napi::threadsafe_function::UnknownReturnValue'],
        ],
        [
          'impl&lt;\'env&gt; UnsafeUnpin for <a class="struct" href="napi/struct.CallContext.html" title="struct napi::CallContext">CallContext</a>&lt;\'env&gt;',
          1,
          ['napi::call_context::CallContext'],
        ],
        [
          'impl&lt;\'scope&gt; UnsafeUnpin for <a class="struct" href="napi/bindgen_prelude/struct.BufferSlice.html" title="struct napi::bindgen_prelude::BufferSlice">BufferSlice</a>&lt;\'scope&gt;',
          1,
          ['napi::bindgen_runtime::js_values::buffer::BufferSlice'],
        ],
        [
          'impl&lt;\'scope&gt; UnsafeUnpin for <a class="struct" href="napi/bindgen_prelude/struct.Uint8ClampedSlice.html" title="struct napi::bindgen_prelude::Uint8ClampedSlice">Uint8ClampedSlice</a>&lt;\'scope&gt;',
          1,
          ['napi::bindgen_runtime::js_values::arraybuffer::Uint8ClampedSlice'],
        ],
        [
          'impl&lt;\'scope, Args, Return&gt; UnsafeUnpin for <a class="struct" href="napi/bindgen_prelude/struct.Function.html" title="struct napi::bindgen_prelude::Function">Function</a>&lt;\'scope, Args, Return&gt;',
          1,
          ['napi::bindgen_runtime::js_values::function::Function'],
        ],
        [
          'impl&lt;A, B&gt; UnsafeUnpin for <a class="enum" href="napi/enum.Either.html" title="enum napi::Either">Either</a>&lt;A, B&gt;<div class="where">where\n    A: UnsafeUnpin,\n    B: UnsafeUnpin,</div>',
          1,
          ['napi::bindgen_runtime::js_values::either::Either'],
        ],
        [
          'impl&lt;A, B, C&gt; UnsafeUnpin for <a class="enum" href="napi/bindgen_prelude/enum.Either3.html" title="enum napi::bindgen_prelude::Either3">Either3</a>&lt;A, B, C&gt;<div class="where">where\n    A: UnsafeUnpin,\n    B: UnsafeUnpin,\n    C: UnsafeUnpin,</div>',
          1,
          ['napi::bindgen_runtime::js_values::either::Either3'],
        ],
        [
          'impl&lt;A, B, C, D&gt; UnsafeUnpin for <a class="enum" href="napi/bindgen_prelude/enum.Either4.html" title="enum napi::bindgen_prelude::Either4">Either4</a>&lt;A, B, C, D&gt;<div class="where">where\n    A: UnsafeUnpin,\n    B: UnsafeUnpin,\n    C: UnsafeUnpin,\n    D: UnsafeUnpin,</div>',
          1,
          ['napi::bindgen_runtime::js_values::either::Either4'],
        ],
        [
          'impl&lt;A, B, C, D, E&gt; UnsafeUnpin for <a class="enum" href="napi/bindgen_prelude/enum.Either5.html" title="enum napi::bindgen_prelude::Either5">Either5</a>&lt;A, B, C, D, E&gt;<div class="where">where\n    A: UnsafeUnpin,\n    B: UnsafeUnpin,\n    C: UnsafeUnpin,\n    D: UnsafeUnpin,\n    E: UnsafeUnpin,</div>',
          1,
          ['napi::bindgen_runtime::js_values::either::Either5'],
        ],
        [
          'impl&lt;A, B, C, D, E, F&gt; UnsafeUnpin for <a class="enum" href="napi/bindgen_prelude/enum.Either6.html" title="enum napi::bindgen_prelude::Either6">Either6</a>&lt;A, B, C, D, E, F&gt;<div class="where">where\n    A: UnsafeUnpin,\n    B: UnsafeUnpin,\n    C: UnsafeUnpin,\n    D: UnsafeUnpin,\n    E: UnsafeUnpin,\n    F: UnsafeUnpin,</div>',
          1,
          ['napi::bindgen_runtime::js_values::either::Either6'],
        ],
        [
          'impl&lt;A, B, C, D, E, F, G&gt; UnsafeUnpin for <a class="enum" href="napi/bindgen_prelude/enum.Either7.html" title="enum napi::bindgen_prelude::Either7">Either7</a>&lt;A, B, C, D, E, F, G&gt;<div class="where">where\n    A: UnsafeUnpin,\n    B: UnsafeUnpin,\n    C: UnsafeUnpin,\n    D: UnsafeUnpin,\n    E: UnsafeUnpin,\n    F: UnsafeUnpin,\n    G: UnsafeUnpin,</div>',
          1,
          ['napi::bindgen_runtime::js_values::either::Either7'],
        ],
        [
          'impl&lt;A, B, C, D, E, F, G, H&gt; UnsafeUnpin for <a class="enum" href="napi/bindgen_prelude/enum.Either8.html" title="enum napi::bindgen_prelude::Either8">Either8</a>&lt;A, B, C, D, E, F, G, H&gt;<div class="where">where\n    A: UnsafeUnpin,\n    B: UnsafeUnpin,\n    C: UnsafeUnpin,\n    D: UnsafeUnpin,\n    E: UnsafeUnpin,\n    F: UnsafeUnpin,\n    G: UnsafeUnpin,\n    H: UnsafeUnpin,</div>',
          1,
          ['napi::bindgen_runtime::js_values::either::Either8'],
        ],
        [
          'impl&lt;A, B, C, D, E, F, G, H, I&gt; UnsafeUnpin for <a class="enum" href="napi/bindgen_prelude/enum.Either9.html" title="enum napi::bindgen_prelude::Either9">Either9</a>&lt;A, B, C, D, E, F, G, H, I&gt;<div class="where">where\n    A: UnsafeUnpin,\n    B: UnsafeUnpin,\n    C: UnsafeUnpin,\n    D: UnsafeUnpin,\n    E: UnsafeUnpin,\n    F: UnsafeUnpin,\n    G: UnsafeUnpin,\n    H: UnsafeUnpin,\n    I: UnsafeUnpin,</div>',
          1,
          ['napi::bindgen_runtime::js_values::either::Either9'],
        ],
        [
          'impl&lt;A, B, C, D, E, F, G, H, I, J&gt; UnsafeUnpin for <a class="enum" href="napi/bindgen_prelude/enum.Either10.html" title="enum napi::bindgen_prelude::Either10">Either10</a>&lt;A, B, C, D, E, F, G, H, I, J&gt;<div class="where">where\n    A: UnsafeUnpin,\n    B: UnsafeUnpin,\n    C: UnsafeUnpin,\n    D: UnsafeUnpin,\n    E: UnsafeUnpin,\n    F: UnsafeUnpin,\n    G: UnsafeUnpin,\n    H: UnsafeUnpin,\n    I: UnsafeUnpin,\n    J: UnsafeUnpin,</div>',
          1,
          ['napi::bindgen_runtime::js_values::either::Either10'],
        ],
        [
          'impl&lt;A, B, C, D, E, F, G, H, I, J, K&gt; UnsafeUnpin for <a class="enum" href="napi/bindgen_prelude/enum.Either11.html" title="enum napi::bindgen_prelude::Either11">Either11</a>&lt;A, B, C, D, E, F, G, H, I, J, K&gt;<div class="where">where\n    A: UnsafeUnpin,\n    B: UnsafeUnpin,\n    C: UnsafeUnpin,\n    D: UnsafeUnpin,\n    E: UnsafeUnpin,\n    F: UnsafeUnpin,\n    G: UnsafeUnpin,\n    H: UnsafeUnpin,\n    I: UnsafeUnpin,\n    J: UnsafeUnpin,\n    K: UnsafeUnpin,</div>',
          1,
          ['napi::bindgen_runtime::js_values::either::Either11'],
        ],
        [
          'impl&lt;A, B, C, D, E, F, G, H, I, J, K, L&gt; UnsafeUnpin for <a class="enum" href="napi/bindgen_prelude/enum.Either12.html" title="enum napi::bindgen_prelude::Either12">Either12</a>&lt;A, B, C, D, E, F, G, H, I, J, K, L&gt;<div class="where">where\n    A: UnsafeUnpin,\n    B: UnsafeUnpin,\n    C: UnsafeUnpin,\n    D: UnsafeUnpin,\n    E: UnsafeUnpin,\n    F: UnsafeUnpin,\n    G: UnsafeUnpin,\n    H: UnsafeUnpin,\n    I: UnsafeUnpin,\n    J: UnsafeUnpin,\n    K: UnsafeUnpin,\n    L: UnsafeUnpin,</div>',
          1,
          ['napi::bindgen_runtime::js_values::either::Either12'],
        ],
        [
          'impl&lt;A, B, C, D, E, F, G, H, I, J, K, L, M&gt; UnsafeUnpin for <a class="enum" href="napi/bindgen_prelude/enum.Either13.html" title="enum napi::bindgen_prelude::Either13">Either13</a>&lt;A, B, C, D, E, F, G, H, I, J, K, L, M&gt;<div class="where">where\n    A: UnsafeUnpin,\n    B: UnsafeUnpin,\n    C: UnsafeUnpin,\n    D: UnsafeUnpin,\n    E: UnsafeUnpin,\n    F: UnsafeUnpin,\n    G: UnsafeUnpin,\n    H: UnsafeUnpin,\n    I: UnsafeUnpin,\n    J: UnsafeUnpin,\n    K: UnsafeUnpin,\n    L: UnsafeUnpin,\n    M: UnsafeUnpin,</div>',
          1,
          ['napi::bindgen_runtime::js_values::either::Either13'],
        ],
        [
          'impl&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N&gt; UnsafeUnpin for <a class="enum" href="napi/bindgen_prelude/enum.Either14.html" title="enum napi::bindgen_prelude::Either14">Either14</a>&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N&gt;<div class="where">where\n    A: UnsafeUnpin,\n    B: UnsafeUnpin,\n    C: UnsafeUnpin,\n    D: UnsafeUnpin,\n    E: UnsafeUnpin,\n    F: UnsafeUnpin,\n    G: UnsafeUnpin,\n    H: UnsafeUnpin,\n    I: UnsafeUnpin,\n    J: UnsafeUnpin,\n    K: UnsafeUnpin,\n    L: UnsafeUnpin,\n    M: UnsafeUnpin,\n    N: UnsafeUnpin,</div>',
          1,
          ['napi::bindgen_runtime::js_values::either::Either14'],
        ],
        [
          'impl&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N, O&gt; UnsafeUnpin for <a class="enum" href="napi/bindgen_prelude/enum.Either15.html" title="enum napi::bindgen_prelude::Either15">Either15</a>&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N, O&gt;<div class="where">where\n    A: UnsafeUnpin,\n    B: UnsafeUnpin,\n    C: UnsafeUnpin,\n    D: UnsafeUnpin,\n    E: UnsafeUnpin,\n    F: UnsafeUnpin,\n    G: UnsafeUnpin,\n    H: UnsafeUnpin,\n    I: UnsafeUnpin,\n    J: UnsafeUnpin,\n    K: UnsafeUnpin,\n    L: UnsafeUnpin,\n    M: UnsafeUnpin,\n    N: UnsafeUnpin,\n    O: UnsafeUnpin,</div>',
          1,
          ['napi::bindgen_runtime::js_values::either::Either15'],
        ],
        [
          'impl&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P&gt; UnsafeUnpin for <a class="enum" href="napi/bindgen_prelude/enum.Either16.html" title="enum napi::bindgen_prelude::Either16">Either16</a>&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P&gt;<div class="where">where\n    A: UnsafeUnpin,\n    B: UnsafeUnpin,\n    C: UnsafeUnpin,\n    D: UnsafeUnpin,\n    E: UnsafeUnpin,\n    F: UnsafeUnpin,\n    G: UnsafeUnpin,\n    H: UnsafeUnpin,\n    I: UnsafeUnpin,\n    J: UnsafeUnpin,\n    K: UnsafeUnpin,\n    L: UnsafeUnpin,\n    M: UnsafeUnpin,\n    N: UnsafeUnpin,\n    O: UnsafeUnpin,\n    P: UnsafeUnpin,</div>',
          1,
          ['napi::bindgen_runtime::js_values::either::Either16'],
        ],
        [
          'impl&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q&gt; UnsafeUnpin for <a class="enum" href="napi/bindgen_prelude/enum.Either17.html" title="enum napi::bindgen_prelude::Either17">Either17</a>&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q&gt;<div class="where">where\n    A: UnsafeUnpin,\n    B: UnsafeUnpin,\n    C: UnsafeUnpin,\n    D: UnsafeUnpin,\n    E: UnsafeUnpin,\n    F: UnsafeUnpin,\n    G: UnsafeUnpin,\n    H: UnsafeUnpin,\n    I: UnsafeUnpin,\n    J: UnsafeUnpin,\n    K: UnsafeUnpin,\n    L: UnsafeUnpin,\n    M: UnsafeUnpin,\n    N: UnsafeUnpin,\n    O: UnsafeUnpin,\n    P: UnsafeUnpin,\n    Q: UnsafeUnpin,</div>',
          1,
          ['napi::bindgen_runtime::js_values::either::Either17'],
        ],
        [
          'impl&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R&gt; UnsafeUnpin for <a class="enum" href="napi/bindgen_prelude/enum.Either18.html" title="enum napi::bindgen_prelude::Either18">Either18</a>&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R&gt;<div class="where">where\n    A: UnsafeUnpin,\n    B: UnsafeUnpin,\n    C: UnsafeUnpin,\n    D: UnsafeUnpin,\n    E: UnsafeUnpin,\n    F: UnsafeUnpin,\n    G: UnsafeUnpin,\n    H: UnsafeUnpin,\n    I: UnsafeUnpin,\n    J: UnsafeUnpin,\n    K: UnsafeUnpin,\n    L: UnsafeUnpin,\n    M: UnsafeUnpin,\n    N: UnsafeUnpin,\n    O: UnsafeUnpin,\n    P: UnsafeUnpin,\n    Q: UnsafeUnpin,\n    R: UnsafeUnpin,</div>',
          1,
          ['napi::bindgen_runtime::js_values::either::Either18'],
        ],
        [
          'impl&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S&gt; UnsafeUnpin for <a class="enum" href="napi/bindgen_prelude/enum.Either19.html" title="enum napi::bindgen_prelude::Either19">Either19</a>&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S&gt;<div class="where">where\n    A: UnsafeUnpin,\n    B: UnsafeUnpin,\n    C: UnsafeUnpin,\n    D: UnsafeUnpin,\n    E: UnsafeUnpin,\n    F: UnsafeUnpin,\n    G: UnsafeUnpin,\n    H: UnsafeUnpin,\n    I: UnsafeUnpin,\n    J: UnsafeUnpin,\n    K: UnsafeUnpin,\n    L: UnsafeUnpin,\n    M: UnsafeUnpin,\n    N: UnsafeUnpin,\n    O: UnsafeUnpin,\n    P: UnsafeUnpin,\n    Q: UnsafeUnpin,\n    R: UnsafeUnpin,\n    S: UnsafeUnpin,</div>',
          1,
          ['napi::bindgen_runtime::js_values::either::Either19'],
        ],
        [
          'impl&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T&gt; UnsafeUnpin for <a class="enum" href="napi/bindgen_prelude/enum.Either20.html" title="enum napi::bindgen_prelude::Either20">Either20</a>&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T&gt;<div class="where">where\n    A: UnsafeUnpin,\n    B: UnsafeUnpin,\n    C: UnsafeUnpin,\n    D: UnsafeUnpin,\n    E: UnsafeUnpin,\n    F: UnsafeUnpin,\n    G: UnsafeUnpin,\n    H: UnsafeUnpin,\n    I: UnsafeUnpin,\n    J: UnsafeUnpin,\n    K: UnsafeUnpin,\n    L: UnsafeUnpin,\n    M: UnsafeUnpin,\n    N: UnsafeUnpin,\n    O: UnsafeUnpin,\n    P: UnsafeUnpin,\n    Q: UnsafeUnpin,\n    R: UnsafeUnpin,\n    S: UnsafeUnpin,\n    T: UnsafeUnpin,</div>',
          1,
          ['napi::bindgen_runtime::js_values::either::Either20'],
        ],
        [
          'impl&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U&gt; UnsafeUnpin for <a class="enum" href="napi/bindgen_prelude/enum.Either21.html" title="enum napi::bindgen_prelude::Either21">Either21</a>&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U&gt;<div class="where">where\n    A: UnsafeUnpin,\n    B: UnsafeUnpin,\n    C: UnsafeUnpin,\n    D: UnsafeUnpin,\n    E: UnsafeUnpin,\n    F: UnsafeUnpin,\n    G: UnsafeUnpin,\n    H: UnsafeUnpin,\n    I: UnsafeUnpin,\n    J: UnsafeUnpin,\n    K: UnsafeUnpin,\n    L: UnsafeUnpin,\n    M: UnsafeUnpin,\n    N: UnsafeUnpin,\n    O: UnsafeUnpin,\n    P: UnsafeUnpin,\n    Q: UnsafeUnpin,\n    R: UnsafeUnpin,\n    S: UnsafeUnpin,\n    T: UnsafeUnpin,\n    U: UnsafeUnpin,</div>',
          1,
          ['napi::bindgen_runtime::js_values::either::Either21'],
        ],
        [
          'impl&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V&gt; UnsafeUnpin for <a class="enum" href="napi/bindgen_prelude/enum.Either22.html" title="enum napi::bindgen_prelude::Either22">Either22</a>&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V&gt;<div class="where">where\n    A: UnsafeUnpin,\n    B: UnsafeUnpin,\n    C: UnsafeUnpin,\n    D: UnsafeUnpin,\n    E: UnsafeUnpin,\n    F: UnsafeUnpin,\n    G: UnsafeUnpin,\n    H: UnsafeUnpin,\n    I: UnsafeUnpin,\n    J: UnsafeUnpin,\n    K: UnsafeUnpin,\n    L: UnsafeUnpin,\n    M: UnsafeUnpin,\n    N: UnsafeUnpin,\n    O: UnsafeUnpin,\n    P: UnsafeUnpin,\n    Q: UnsafeUnpin,\n    R: UnsafeUnpin,\n    S: UnsafeUnpin,\n    T: UnsafeUnpin,\n    U: UnsafeUnpin,\n    V: UnsafeUnpin,</div>',
          1,
          ['napi::bindgen_runtime::js_values::either::Either22'],
        ],
        [
          'impl&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W&gt; UnsafeUnpin for <a class="enum" href="napi/bindgen_prelude/enum.Either23.html" title="enum napi::bindgen_prelude::Either23">Either23</a>&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W&gt;<div class="where">where\n    A: UnsafeUnpin,\n    B: UnsafeUnpin,\n    C: UnsafeUnpin,\n    D: UnsafeUnpin,\n    E: UnsafeUnpin,\n    F: UnsafeUnpin,\n    G: UnsafeUnpin,\n    H: UnsafeUnpin,\n    I: UnsafeUnpin,\n    J: UnsafeUnpin,\n    K: UnsafeUnpin,\n    L: UnsafeUnpin,\n    M: UnsafeUnpin,\n    N: UnsafeUnpin,\n    O: UnsafeUnpin,\n    P: UnsafeUnpin,\n    Q: UnsafeUnpin,\n    R: UnsafeUnpin,\n    S: UnsafeUnpin,\n    T: UnsafeUnpin,\n    U: UnsafeUnpin,\n    V: UnsafeUnpin,\n    W: UnsafeUnpin,</div>',
          1,
          ['napi::bindgen_runtime::js_values::either::Either23'],
        ],
        [
          'impl&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X&gt; UnsafeUnpin for <a class="enum" href="napi/bindgen_prelude/enum.Either24.html" title="enum napi::bindgen_prelude::Either24">Either24</a>&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X&gt;<div class="where">where\n    A: UnsafeUnpin,\n    B: UnsafeUnpin,\n    C: UnsafeUnpin,\n    D: UnsafeUnpin,\n    E: UnsafeUnpin,\n    F: UnsafeUnpin,\n    G: UnsafeUnpin,\n    H: UnsafeUnpin,\n    I: UnsafeUnpin,\n    J: UnsafeUnpin,\n    K: UnsafeUnpin,\n    L: UnsafeUnpin,\n    M: UnsafeUnpin,\n    N: UnsafeUnpin,\n    O: UnsafeUnpin,\n    P: UnsafeUnpin,\n    Q: UnsafeUnpin,\n    R: UnsafeUnpin,\n    S: UnsafeUnpin,\n    T: UnsafeUnpin,\n    U: UnsafeUnpin,\n    V: UnsafeUnpin,\n    W: UnsafeUnpin,\n    X: UnsafeUnpin,</div>',
          1,
          ['napi::bindgen_runtime::js_values::either::Either24'],
        ],
        [
          'impl&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y&gt; UnsafeUnpin for <a class="enum" href="napi/bindgen_prelude/enum.Either25.html" title="enum napi::bindgen_prelude::Either25">Either25</a>&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y&gt;<div class="where">where\n    A: UnsafeUnpin,\n    B: UnsafeUnpin,\n    C: UnsafeUnpin,\n    D: UnsafeUnpin,\n    E: UnsafeUnpin,\n    F: UnsafeUnpin,\n    G: UnsafeUnpin,\n    H: UnsafeUnpin,\n    I: UnsafeUnpin,\n    J: UnsafeUnpin,\n    K: UnsafeUnpin,\n    L: UnsafeUnpin,\n    M: UnsafeUnpin,\n    N: UnsafeUnpin,\n    O: UnsafeUnpin,\n    P: UnsafeUnpin,\n    Q: UnsafeUnpin,\n    R: UnsafeUnpin,\n    S: UnsafeUnpin,\n    T: UnsafeUnpin,\n    U: UnsafeUnpin,\n    V: UnsafeUnpin,\n    W: UnsafeUnpin,\n    X: UnsafeUnpin,\n    Y: UnsafeUnpin,</div>',
          1,
          ['napi::bindgen_runtime::js_values::either::Either25'],
        ],
        [
          'impl&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z&gt; UnsafeUnpin for <a class="enum" href="napi/bindgen_prelude/enum.Either26.html" title="enum napi::bindgen_prelude::Either26">Either26</a>&lt;A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z&gt;<div class="where">where\n    A: UnsafeUnpin,\n    B: UnsafeUnpin,\n    C: UnsafeUnpin,\n    D: UnsafeUnpin,\n    E: UnsafeUnpin,\n    F: UnsafeUnpin,\n    G: UnsafeUnpin,\n    H: UnsafeUnpin,\n    I: UnsafeUnpin,\n    J: UnsafeUnpin,\n    K: UnsafeUnpin,\n    L: UnsafeUnpin,\n    M: UnsafeUnpin,\n    N: UnsafeUnpin,\n    O: UnsafeUnpin,\n    P: UnsafeUnpin,\n    Q: UnsafeUnpin,\n    R: UnsafeUnpin,\n    S: UnsafeUnpin,\n    T: UnsafeUnpin,\n    U: UnsafeUnpin,\n    V: UnsafeUnpin,\n    W: UnsafeUnpin,\n    X: UnsafeUnpin,\n    Y: UnsafeUnpin,\n    Z: UnsafeUnpin,</div>',
          1,
          ['napi::bindgen_runtime::js_values::either::Either26'],
        ],
        [
          'impl&lt;Args, Return&gt; UnsafeUnpin for <a class="struct" href="napi/bindgen_prelude/struct.FunctionRef.html" title="struct napi::bindgen_prelude::FunctionRef">FunctionRef</a>&lt;Args, Return&gt;',
          1,
          ['napi::bindgen_runtime::js_values::function::FunctionRef'],
        ],
        [
          'impl&lt;Data, Resolver&gt; UnsafeUnpin for <a class="struct" href="napi/struct.JsDeferred.html" title="struct napi::JsDeferred">JsDeferred</a>&lt;Data, Resolver&gt;',
          1,
          ['napi::js_values::deferred::JsDeferred'],
        ],
        [
          'impl&lt;S&gt; UnsafeUnpin for <a class="struct" href="napi/struct.Error.html" title="struct napi::Error">Error</a>&lt;S&gt;<div class="where">where\n    S: UnsafeUnpin,</div>',
          1,
          ['napi::error::Error'],
        ],
        [
          'impl&lt;S&gt; UnsafeUnpin for <a class="struct" href="napi/struct.JsError.html" title="struct napi::JsError">JsError</a>&lt;S&gt;<div class="where">where\n    S: UnsafeUnpin,</div>',
          1,
          ['napi::error::JsError'],
        ],
        [
          'impl&lt;S&gt; UnsafeUnpin for <a class="struct" href="napi/struct.JsRangeError.html" title="struct napi::JsRangeError">JsRangeError</a>&lt;S&gt;<div class="where">where\n    S: UnsafeUnpin,</div>',
          1,
          ['napi::error::JsRangeError'],
        ],
        [
          'impl&lt;S&gt; UnsafeUnpin for <a class="struct" href="napi/struct.JsTypeError.html" title="struct napi::JsTypeError">JsTypeError</a>&lt;S&gt;<div class="where">where\n    S: UnsafeUnpin,</div>',
          1,
          ['napi::error::JsTypeError'],
        ],
        [
          'impl&lt;T&gt; UnsafeUnpin for <a class="struct" href="napi/bindgen_prelude/struct.AsyncTask.html" title="struct napi::bindgen_prelude::AsyncTask">AsyncTask</a>&lt;T&gt;<div class="where">where\n    T: UnsafeUnpin,</div>',
          1,
          ['napi::bindgen_runtime::js_values::task::AsyncTask'],
        ],
        [
          'impl&lt;T&gt; UnsafeUnpin for <a class="struct" href="napi/bindgen_prelude/struct.ClassInstance.html" title="struct napi::bindgen_prelude::ClassInstance">ClassInstance</a>&lt;T&gt;',
          1,
          ['napi::bindgen_runtime::js_values::class::ClassInstance'],
        ],
        [
          'impl&lt;T&gt; UnsafeUnpin for <a class="struct" href="napi/bindgen_prelude/struct.External.html" title="struct napi::bindgen_prelude::External">External</a>&lt;T&gt;',
          1,
          ['napi::bindgen_runtime::js_values::external::External'],
        ],
        [
          'impl&lt;T&gt; UnsafeUnpin for <a class="struct" href="napi/bindgen_prelude/struct.Reference.html" title="struct napi::bindgen_prelude::Reference">Reference</a>&lt;T&gt;',
          1,
          ['napi::bindgen_runtime::js_values::value_ref::Reference'],
        ],
        [
          'impl&lt;T&gt; UnsafeUnpin for <a class="struct" href="napi/bindgen_prelude/struct.WeakReference.html" title="struct napi::bindgen_prelude::WeakReference">WeakReference</a>&lt;T&gt;',
          1,
          ['napi::bindgen_runtime::js_values::value_ref::WeakReference'],
        ],
        [
          'impl&lt;T&gt; UnsafeUnpin for <a class="struct" href="napi/struct.CleanupEnvHook.html" title="struct napi::CleanupEnvHook">CleanupEnvHook</a>&lt;T&gt;',
          1,
          ['napi::cleanup_env::CleanupEnvHook'],
        ],
        [
          'impl&lt;T&gt; UnsafeUnpin for <a class="struct" href="napi/struct.EscapableHandleScope.html" title="struct napi::EscapableHandleScope">EscapableHandleScope</a>&lt;T&gt;<div class="where">where\n    T: UnsafeUnpin,</div>',
          1,
          ['napi::js_values::escapable_handle_scope::EscapableHandleScope'],
        ],
        [
          'impl&lt;T&gt; UnsafeUnpin for <a class="struct" href="napi/struct.Ref.html" title="struct napi::Ref">Ref</a>&lt;T&gt;<div class="where">where\n    T: UnsafeUnpin,</div>',
          1,
          ['napi::js_values::value_ref::Ref'],
        ],
        [
          'impl&lt;T&gt; UnsafeUnpin for <a class="struct" href="napi/threadsafe_function/struct.ThreadSafeCallContext.html" title="struct napi::threadsafe_function::ThreadSafeCallContext">ThreadSafeCallContext</a>&lt;T&gt;<div class="where">where\n    T: UnsafeUnpin,</div>',
          1,
          ['napi::threadsafe_function::ThreadSafeCallContext'],
        ],
        [
          'impl&lt;T, ES&gt; UnsafeUnpin for <a class="struct" href="napi/threadsafe_function/struct.ThreadsafeFunction.html" title="struct napi::threadsafe_function::ThreadsafeFunction">ThreadsafeFunction</a>&lt;T, ES&gt;',
          1,
          ['napi::threadsafe_function::ThreadsafeFunction'],
        ],
        [
          'impl&lt;T, S&gt; UnsafeUnpin for <a class="struct" href="napi/bindgen_prelude/struct.SharedReference.html" title="struct napi::bindgen_prelude::SharedReference">SharedReference</a>&lt;T, S&gt;',
          1,
          ['napi::bindgen_runtime::js_values::value_ref::SharedReference'],
        ],
      ],
    ],
    [
      'napi_derive_backend',
      [
        [
          'impl UnsafeUnpin for <a class="enum" href="napi_derive_backend/ast/enum.FnKind.html" title="enum napi_derive_backend::ast::FnKind">FnKind</a>',
          1,
          ['napi_derive_backend::ast::FnKind'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="napi_derive_backend/ast/enum.FnSelf.html" title="enum napi_derive_backend::ast::FnSelf">FnSelf</a>',
          1,
          ['napi_derive_backend::ast::FnSelf'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="napi_derive_backend/ast/enum.NapiEnumValue.html" title="enum napi_derive_backend::ast::NapiEnumValue">NapiEnumValue</a>',
          1,
          ['napi_derive_backend::ast::NapiEnumValue'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="napi_derive_backend/ast/enum.NapiFnArgKind.html" title="enum napi_derive_backend::ast::NapiFnArgKind">NapiFnArgKind</a>',
          1,
          ['napi_derive_backend::ast::NapiFnArgKind'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="napi_derive_backend/ast/enum.NapiStructKind.html" title="enum napi_derive_backend::ast::NapiStructKind">NapiStructKind</a>',
          1,
          ['napi_derive_backend::ast::NapiStructKind'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="napi_derive_backend/enum.NapiItem.html" title="enum napi_derive_backend::NapiItem">NapiItem</a>',
          1,
          ['napi_derive_backend::NapiItem'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi_derive_backend/ast/struct.CallbackArg.html" title="struct napi_derive_backend::ast::CallbackArg">CallbackArg</a>',
          1,
          ['napi_derive_backend::ast::CallbackArg'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi_derive_backend/ast/struct.NapiConst.html" title="struct napi_derive_backend::ast::NapiConst">NapiConst</a>',
          1,
          ['napi_derive_backend::ast::NapiConst'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi_derive_backend/ast/struct.NapiEnum.html" title="struct napi_derive_backend::ast::NapiEnum">NapiEnum</a>',
          1,
          ['napi_derive_backend::ast::NapiEnum'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi_derive_backend/ast/struct.NapiEnumVariant.html" title="struct napi_derive_backend::ast::NapiEnumVariant">NapiEnumVariant</a>',
          1,
          ['napi_derive_backend::ast::NapiEnumVariant'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi_derive_backend/ast/struct.NapiFn.html" title="struct napi_derive_backend::ast::NapiFn">NapiFn</a>',
          1,
          ['napi_derive_backend::ast::NapiFn'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi_derive_backend/ast/struct.NapiFnArg.html" title="struct napi_derive_backend::ast::NapiFnArg">NapiFnArg</a>',
          1,
          ['napi_derive_backend::ast::NapiFnArg'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi_derive_backend/ast/struct.NapiImpl.html" title="struct napi_derive_backend::ast::NapiImpl">NapiImpl</a>',
          1,
          ['napi_derive_backend::ast::NapiImpl'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi_derive_backend/ast/struct.NapiMod.html" title="struct napi_derive_backend::ast::NapiMod">NapiMod</a>',
          1,
          ['napi_derive_backend::ast::NapiMod'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi_derive_backend/ast/struct.NapiStruct.html" title="struct napi_derive_backend::ast::NapiStruct">NapiStruct</a>',
          1,
          ['napi_derive_backend::ast::NapiStruct'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi_derive_backend/ast/struct.NapiStructField.html" title="struct napi_derive_backend::ast::NapiStructField">NapiStructField</a>',
          1,
          ['napi_derive_backend::ast::NapiStructField'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi_derive_backend/error/struct.Diagnostic.html" title="struct napi_derive_backend::error::Diagnostic">Diagnostic</a>',
          1,
          ['napi_derive_backend::error::Diagnostic'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi_derive_backend/struct.Napi.html" title="struct napi_derive_backend::Napi">Napi</a>',
          1,
          ['napi_derive_backend::Napi'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi_derive_backend/typegen/struct.TypeDef.html" title="struct napi_derive_backend::typegen::TypeDef">TypeDef</a>',
          1,
          ['napi_derive_backend::typegen::TypeDef'],
        ],
      ],
    ],
    [
      'napi_sys',
      [
        [
          'impl UnsafeUnpin for <a class="enum" href="napi_sys/enum.uv_run_mode.html" title="enum napi_sys::uv_run_mode">uv_run_mode</a>',
          1,
          ['napi_sys::types::uv_run_mode'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi_sys/struct.napi_async_context__.html" title="struct napi_sys::napi_async_context__">napi_async_context__</a>',
          1,
          ['napi_sys::types::napi_async_context__'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi_sys/struct.napi_async_work__.html" title="struct napi_sys::napi_async_work__">napi_async_work__</a>',
          1,
          ['napi_sys::types::napi_async_work__'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi_sys/struct.napi_callback_info__.html" title="struct napi_sys::napi_callback_info__">napi_callback_info__</a>',
          1,
          ['napi_sys::types::napi_callback_info__'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi_sys/struct.napi_callback_scope__.html" title="struct napi_sys::napi_callback_scope__">napi_callback_scope__</a>',
          1,
          ['napi_sys::types::napi_callback_scope__'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi_sys/struct.napi_deferred__.html" title="struct napi_sys::napi_deferred__">napi_deferred__</a>',
          1,
          ['napi_sys::types::napi_deferred__'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi_sys/struct.napi_env__.html" title="struct napi_sys::napi_env__">napi_env__</a>',
          1,
          ['napi_sys::types::napi_env__'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi_sys/struct.napi_escapable_handle_scope__.html" title="struct napi_sys::napi_escapable_handle_scope__">napi_escapable_handle_scope__</a>',
          1,
          ['napi_sys::types::napi_escapable_handle_scope__'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi_sys/struct.napi_extended_error_info.html" title="struct napi_sys::napi_extended_error_info">napi_extended_error_info</a>',
          1,
          ['napi_sys::types::napi_extended_error_info'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi_sys/struct.napi_handle_scope__.html" title="struct napi_sys::napi_handle_scope__">napi_handle_scope__</a>',
          1,
          ['napi_sys::types::napi_handle_scope__'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi_sys/struct.napi_module.html" title="struct napi_sys::napi_module">napi_module</a>',
          1,
          ['napi_sys::types::napi_module'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi_sys/struct.napi_node_version.html" title="struct napi_sys::napi_node_version">napi_node_version</a>',
          1,
          ['napi_sys::types::napi_node_version'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi_sys/struct.napi_property_descriptor.html" title="struct napi_sys::napi_property_descriptor">napi_property_descriptor</a>',
          1,
          ['napi_sys::types::napi_property_descriptor'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi_sys/struct.napi_ref__.html" title="struct napi_sys::napi_ref__">napi_ref__</a>',
          1,
          ['napi_sys::types::napi_ref__'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi_sys/struct.napi_threadsafe_function__.html" title="struct napi_sys::napi_threadsafe_function__">napi_threadsafe_function__</a>',
          1,
          ['napi_sys::types::napi_threadsafe_function__'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi_sys/struct.napi_value__.html" title="struct napi_sys::napi_value__">napi_value__</a>',
          1,
          ['napi_sys::types::napi_value__'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="napi_sys/struct.uv_loop_s.html" title="struct napi_sys::uv_loop_s">uv_loop_s</a>',
          1,
          ['napi_sys::types::uv_loop_s'],
        ],
      ],
    ],
    [
      'once_cell',
      [
        [
          'impl UnsafeUnpin for <a class="struct" href="once_cell/race/struct.OnceBool.html" title="struct once_cell::race::OnceBool">OnceBool</a>',
          1,
          ['once_cell::race::OnceBool'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="once_cell/race/struct.OnceNonZeroUsize.html" title="struct once_cell::race::OnceNonZeroUsize">OnceNonZeroUsize</a>',
          1,
          ['once_cell::race::OnceNonZeroUsize'],
        ],
        [
          'impl&lt;\'a, T&gt; UnsafeUnpin for <a class="struct" href="once_cell/race/struct.OnceRef.html" title="struct once_cell::race::OnceRef">OnceRef</a>&lt;\'a, T&gt;',
          1,
          ['once_cell::race::OnceRef'],
        ],
        [
          'impl&lt;T&gt; UnsafeUnpin for <a class="struct" href="once_cell/race/struct.OnceBox.html" title="struct once_cell::race::OnceBox">OnceBox</a>&lt;T&gt;',
          1,
          ['once_cell::race::once_box::OnceBox'],
        ],
        [
          'impl&lt;T&gt; UnsafeUnpin for <a class="struct" href="once_cell/sync/struct.OnceCell.html" title="struct once_cell::sync::OnceCell">OnceCell</a>&lt;T&gt;<div class="where">where\n    T: UnsafeUnpin,</div>',
          1,
          ['once_cell::sync::OnceCell'],
        ],
        [
          'impl&lt;T&gt; UnsafeUnpin for <a class="struct" href="once_cell/unsync/struct.OnceCell.html" title="struct once_cell::unsync::OnceCell">OnceCell</a>&lt;T&gt;<div class="where">where\n    T: UnsafeUnpin,</div>',
          1,
          ['once_cell::unsync::OnceCell'],
        ],
        [
          'impl&lt;T, F&gt; UnsafeUnpin for <a class="struct" href="once_cell/sync/struct.Lazy.html" title="struct once_cell::sync::Lazy">Lazy</a>&lt;T, F&gt;<div class="where">where\n    F: UnsafeUnpin,\n    T: UnsafeUnpin,</div>',
          1,
          ['once_cell::sync::Lazy'],
        ],
        [
          'impl&lt;T, F&gt; UnsafeUnpin for <a class="struct" href="once_cell/unsync/struct.Lazy.html" title="struct once_cell::unsync::Lazy">Lazy</a>&lt;T, F&gt;<div class="where">where\n    T: UnsafeUnpin,\n    F: UnsafeUnpin,</div>',
          1,
          ['once_cell::unsync::Lazy'],
        ],
      ],
    ],
    [
      'proc_macro2',
      [
        [
          'impl UnsafeUnpin for <a class="enum" href="proc_macro2/enum.Delimiter.html" title="enum proc_macro2::Delimiter">Delimiter</a>',
          1,
          ['proc_macro2::Delimiter'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="proc_macro2/enum.Spacing.html" title="enum proc_macro2::Spacing">Spacing</a>',
          1,
          ['proc_macro2::Spacing'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="proc_macro2/enum.TokenTree.html" title="enum proc_macro2::TokenTree">TokenTree</a>',
          1,
          ['proc_macro2::TokenTree'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="proc_macro2/extra/struct.DelimSpan.html" title="struct proc_macro2::extra::DelimSpan">DelimSpan</a>',
          1,
          ['proc_macro2::extra::DelimSpan'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="proc_macro2/struct.Group.html" title="struct proc_macro2::Group">Group</a>',
          1,
          ['proc_macro2::Group'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="proc_macro2/struct.Ident.html" title="struct proc_macro2::Ident">Ident</a>',
          1,
          ['proc_macro2::Ident'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="proc_macro2/struct.LexError.html" title="struct proc_macro2::LexError">LexError</a>',
          1,
          ['proc_macro2::LexError'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="proc_macro2/struct.Literal.html" title="struct proc_macro2::Literal">Literal</a>',
          1,
          ['proc_macro2::Literal'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="proc_macro2/struct.Punct.html" title="struct proc_macro2::Punct">Punct</a>',
          1,
          ['proc_macro2::Punct'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="proc_macro2/struct.Span.html" title="struct proc_macro2::Span">Span</a>',
          1,
          ['proc_macro2::Span'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="proc_macro2/struct.TokenStream.html" title="struct proc_macro2::TokenStream">TokenStream</a>',
          1,
          ['proc_macro2::TokenStream'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="proc_macro2/token_stream/struct.IntoIter.html" title="struct proc_macro2::token_stream::IntoIter">IntoIter</a>',
          1,
          ['proc_macro2::token_stream::IntoIter'],
        ],
      ],
    ],
    [
      'reed_solomon_simd',
      [
        [
          'impl UnsafeUnpin for <a class="enum" href="reed_solomon_simd/enum.Error.html" title="enum reed_solomon_simd::Error">Error</a>',
          1,
          ['reed_solomon_simd::Error'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="reed_solomon_simd/engine/struct.DefaultEngine.html" title="struct reed_solomon_simd::engine::DefaultEngine">DefaultEngine</a>',
          1,
          ['reed_solomon_simd::engine::engine_default::DefaultEngine'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="reed_solomon_simd/engine/struct.Naive.html" title="struct reed_solomon_simd::engine::Naive">Naive</a>',
          1,
          ['reed_solomon_simd::engine::engine_naive::Naive'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="reed_solomon_simd/engine/struct.Neon.html" title="struct reed_solomon_simd::engine::Neon">Neon</a>',
          1,
          ['reed_solomon_simd::engine::engine_neon::Neon'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="reed_solomon_simd/engine/struct.NoSimd.html" title="struct reed_solomon_simd::engine::NoSimd">NoSimd</a>',
          1,
          ['reed_solomon_simd::engine::engine_nosimd::NoSimd'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="reed_solomon_simd/engine/tables/struct.ExpLog.html" title="struct reed_solomon_simd::engine::tables::ExpLog">ExpLog</a>',
          1,
          ['reed_solomon_simd::engine::tables::ExpLog'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="reed_solomon_simd/engine/tables/struct.Multiply128lutT.html" title="struct reed_solomon_simd::engine::tables::Multiply128lutT">Multiply128lutT</a>',
          1,
          ['reed_solomon_simd::engine::tables::Multiply128lutT'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="reed_solomon_simd/rate/struct.DecoderWork.html" title="struct reed_solomon_simd::rate::DecoderWork">DecoderWork</a>',
          1,
          ['reed_solomon_simd::rate::decoder_work::DecoderWork'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="reed_solomon_simd/rate/struct.EncoderWork.html" title="struct reed_solomon_simd::rate::EncoderWork">EncoderWork</a>',
          1,
          ['reed_solomon_simd::rate::encoder_work::EncoderWork'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="reed_solomon_simd/struct.ReedSolomonDecoder.html" title="struct reed_solomon_simd::ReedSolomonDecoder">ReedSolomonDecoder</a>',
          1,
          ['reed_solomon_simd::reed_solomon::ReedSolomonDecoder'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="reed_solomon_simd/struct.ReedSolomonEncoder.html" title="struct reed_solomon_simd::ReedSolomonEncoder">ReedSolomonEncoder</a>',
          1,
          ['reed_solomon_simd::reed_solomon::ReedSolomonEncoder'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="reed_solomon_simd/engine/struct.ShardsRefMut.html" title="struct reed_solomon_simd::engine::ShardsRefMut">ShardsRefMut</a>&lt;\'a&gt;',
          1,
          ['reed_solomon_simd::engine::shards::ShardsRefMut'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="reed_solomon_simd/struct.DecoderResult.html" title="struct reed_solomon_simd::DecoderResult">DecoderResult</a>&lt;\'a&gt;',
          1,
          ['reed_solomon_simd::decoder_result::DecoderResult'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="reed_solomon_simd/struct.EncoderResult.html" title="struct reed_solomon_simd::EncoderResult">EncoderResult</a>&lt;\'a&gt;',
          1,
          ['reed_solomon_simd::encoder_result::EncoderResult'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="reed_solomon_simd/struct.Recovery.html" title="struct reed_solomon_simd::Recovery">Recovery</a>&lt;\'a&gt;',
          1,
          ['reed_solomon_simd::encoder_result::Recovery'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="reed_solomon_simd/struct.RestoredOriginal.html" title="struct reed_solomon_simd::RestoredOriginal">RestoredOriginal</a>&lt;\'a&gt;',
          1,
          ['reed_solomon_simd::decoder_result::RestoredOriginal'],
        ],
        [
          'impl&lt;E&gt; UnsafeUnpin for <a class="struct" href="reed_solomon_simd/rate/struct.DefaultRate.html" title="struct reed_solomon_simd::rate::DefaultRate">DefaultRate</a>&lt;E&gt;',
          1,
          ['reed_solomon_simd::rate::rate_default::DefaultRate'],
        ],
        [
          'impl&lt;E&gt; UnsafeUnpin for <a class="struct" href="reed_solomon_simd/rate/struct.DefaultRateDecoder.html" title="struct reed_solomon_simd::rate::DefaultRateDecoder">DefaultRateDecoder</a>&lt;E&gt;<div class="where">where\n    E: UnsafeUnpin,</div>',
          1,
          ['reed_solomon_simd::rate::rate_default::DefaultRateDecoder'],
        ],
        [
          'impl&lt;E&gt; UnsafeUnpin for <a class="struct" href="reed_solomon_simd/rate/struct.DefaultRateEncoder.html" title="struct reed_solomon_simd::rate::DefaultRateEncoder">DefaultRateEncoder</a>&lt;E&gt;<div class="where">where\n    E: UnsafeUnpin,</div>',
          1,
          ['reed_solomon_simd::rate::rate_default::DefaultRateEncoder'],
        ],
        [
          'impl&lt;E&gt; UnsafeUnpin for <a class="struct" href="reed_solomon_simd/rate/struct.HighRate.html" title="struct reed_solomon_simd::rate::HighRate">HighRate</a>&lt;E&gt;',
          1,
          ['reed_solomon_simd::rate::rate_high::HighRate'],
        ],
        [
          'impl&lt;E&gt; UnsafeUnpin for <a class="struct" href="reed_solomon_simd/rate/struct.HighRateDecoder.html" title="struct reed_solomon_simd::rate::HighRateDecoder">HighRateDecoder</a>&lt;E&gt;<div class="where">where\n    E: UnsafeUnpin,</div>',
          1,
          ['reed_solomon_simd::rate::rate_high::HighRateDecoder'],
        ],
        [
          'impl&lt;E&gt; UnsafeUnpin for <a class="struct" href="reed_solomon_simd/rate/struct.HighRateEncoder.html" title="struct reed_solomon_simd::rate::HighRateEncoder">HighRateEncoder</a>&lt;E&gt;<div class="where">where\n    E: UnsafeUnpin,</div>',
          1,
          ['reed_solomon_simd::rate::rate_high::HighRateEncoder'],
        ],
        [
          'impl&lt;E&gt; UnsafeUnpin for <a class="struct" href="reed_solomon_simd/rate/struct.LowRate.html" title="struct reed_solomon_simd::rate::LowRate">LowRate</a>&lt;E&gt;',
          1,
          ['reed_solomon_simd::rate::rate_low::LowRate'],
        ],
        [
          'impl&lt;E&gt; UnsafeUnpin for <a class="struct" href="reed_solomon_simd/rate/struct.LowRateDecoder.html" title="struct reed_solomon_simd::rate::LowRateDecoder">LowRateDecoder</a>&lt;E&gt;<div class="where">where\n    E: UnsafeUnpin,</div>',
          1,
          ['reed_solomon_simd::rate::rate_low::LowRateDecoder'],
        ],
        [
          'impl&lt;E&gt; UnsafeUnpin for <a class="struct" href="reed_solomon_simd/rate/struct.LowRateEncoder.html" title="struct reed_solomon_simd::rate::LowRateEncoder">LowRateEncoder</a>&lt;E&gt;<div class="where">where\n    E: UnsafeUnpin,</div>',
          1,
          ['reed_solomon_simd::rate::rate_low::LowRateEncoder'],
        ],
      ],
    ],
    [
      'regex',
      [
        [
          'impl UnsafeUnpin for <a class="enum" href="regex/enum.Error.html" title="enum regex::Error">Error</a>',
          1,
          ['regex::error::Error'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex/bytes/struct.CaptureLocations.html" title="struct regex::bytes::CaptureLocations">CaptureLocations</a>',
          1,
          ['regex::regex::bytes::CaptureLocations'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex/bytes/struct.Regex.html" title="struct regex::bytes::Regex">Regex</a>',
          1,
          ['regex::regex::bytes::Regex'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex/bytes/struct.RegexBuilder.html" title="struct regex::bytes::RegexBuilder">RegexBuilder</a>',
          1,
          ['regex::builders::bytes::RegexBuilder'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex/bytes/struct.RegexSet.html" title="struct regex::bytes::RegexSet">RegexSet</a>',
          1,
          ['regex::regexset::bytes::RegexSet'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex/bytes/struct.RegexSetBuilder.html" title="struct regex::bytes::RegexSetBuilder">RegexSetBuilder</a>',
          1,
          ['regex::builders::bytes::RegexSetBuilder'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex/bytes/struct.SetMatches.html" title="struct regex::bytes::SetMatches">SetMatches</a>',
          1,
          ['regex::regexset::bytes::SetMatches'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex/bytes/struct.SetMatchesIntoIter.html" title="struct regex::bytes::SetMatchesIntoIter">SetMatchesIntoIter</a>',
          1,
          ['regex::regexset::bytes::SetMatchesIntoIter'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex/struct.CaptureLocations.html" title="struct regex::CaptureLocations">CaptureLocations</a>',
          1,
          ['regex::regex::string::CaptureLocations'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex/struct.Regex.html" title="struct regex::Regex">Regex</a>',
          1,
          ['regex::regex::string::Regex'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex/struct.RegexBuilder.html" title="struct regex::RegexBuilder">RegexBuilder</a>',
          1,
          ['regex::builders::string::RegexBuilder'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex/struct.RegexSet.html" title="struct regex::RegexSet">RegexSet</a>',
          1,
          ['regex::regexset::string::RegexSet'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex/struct.RegexSetBuilder.html" title="struct regex::RegexSetBuilder">RegexSetBuilder</a>',
          1,
          ['regex::builders::string::RegexSetBuilder'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex/struct.SetMatches.html" title="struct regex::SetMatches">SetMatches</a>',
          1,
          ['regex::regexset::string::SetMatches'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex/struct.SetMatchesIntoIter.html" title="struct regex::SetMatchesIntoIter">SetMatchesIntoIter</a>',
          1,
          ['regex::regexset::string::SetMatchesIntoIter'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="regex/bytes/struct.SetMatchesIter.html" title="struct regex::bytes::SetMatchesIter">SetMatchesIter</a>&lt;\'a&gt;',
          1,
          ['regex::regexset::bytes::SetMatchesIter'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="regex/struct.SetMatchesIter.html" title="struct regex::SetMatchesIter">SetMatchesIter</a>&lt;\'a&gt;',
          1,
          ['regex::regexset::string::SetMatchesIter'],
        ],
        [
          'impl&lt;\'a, R&gt; UnsafeUnpin for <a class="struct" href="regex/bytes/struct.ReplacerRef.html" title="struct regex::bytes::ReplacerRef">ReplacerRef</a>&lt;\'a, R&gt;<div class="where">where\n    R: ?<a class="trait" href="https://doc.rust-lang.org/nightly/core/marker/trait.Sized.html" title="trait core::marker::Sized">Sized</a>,</div>',
          1,
          ['regex::regex::bytes::ReplacerRef'],
        ],
        [
          'impl&lt;\'a, R&gt; UnsafeUnpin for <a class="struct" href="regex/struct.ReplacerRef.html" title="struct regex::ReplacerRef">ReplacerRef</a>&lt;\'a, R&gt;<div class="where">where\n    R: ?<a class="trait" href="https://doc.rust-lang.org/nightly/core/marker/trait.Sized.html" title="trait core::marker::Sized">Sized</a>,</div>',
          1,
          ['regex::regex::string::ReplacerRef'],
        ],
        [
          'impl&lt;\'c, \'h&gt; UnsafeUnpin for <a class="struct" href="regex/bytes/struct.SubCaptureMatches.html" title="struct regex::bytes::SubCaptureMatches">SubCaptureMatches</a>&lt;\'c, \'h&gt;',
          1,
          ['regex::regex::bytes::SubCaptureMatches'],
        ],
        [
          'impl&lt;\'c, \'h&gt; UnsafeUnpin for <a class="struct" href="regex/struct.SubCaptureMatches.html" title="struct regex::SubCaptureMatches">SubCaptureMatches</a>&lt;\'c, \'h&gt;',
          1,
          ['regex::regex::string::SubCaptureMatches'],
        ],
        [
          'impl&lt;\'h&gt; UnsafeUnpin for <a class="struct" href="regex/bytes/struct.Captures.html" title="struct regex::bytes::Captures">Captures</a>&lt;\'h&gt;',
          1,
          ['regex::regex::bytes::Captures'],
        ],
        [
          'impl&lt;\'h&gt; UnsafeUnpin for <a class="struct" href="regex/bytes/struct.Match.html" title="struct regex::bytes::Match">Match</a>&lt;\'h&gt;',
          1,
          ['regex::regex::bytes::Match'],
        ],
        [
          'impl&lt;\'h&gt; UnsafeUnpin for <a class="struct" href="regex/struct.Captures.html" title="struct regex::Captures">Captures</a>&lt;\'h&gt;',
          1,
          ['regex::regex::string::Captures'],
        ],
        [
          'impl&lt;\'h&gt; UnsafeUnpin for <a class="struct" href="regex/struct.Match.html" title="struct regex::Match">Match</a>&lt;\'h&gt;',
          1,
          ['regex::regex::string::Match'],
        ],
        [
          'impl&lt;\'r&gt; UnsafeUnpin for <a class="struct" href="regex/bytes/struct.CaptureNames.html" title="struct regex::bytes::CaptureNames">CaptureNames</a>&lt;\'r&gt;',
          1,
          ['regex::regex::bytes::CaptureNames'],
        ],
        [
          'impl&lt;\'r&gt; UnsafeUnpin for <a class="struct" href="regex/struct.CaptureNames.html" title="struct regex::CaptureNames">CaptureNames</a>&lt;\'r&gt;',
          1,
          ['regex::regex::string::CaptureNames'],
        ],
        [
          'impl&lt;\'r, \'h&gt; UnsafeUnpin for <a class="struct" href="regex/bytes/struct.CaptureMatches.html" title="struct regex::bytes::CaptureMatches">CaptureMatches</a>&lt;\'r, \'h&gt;',
          1,
          ['regex::regex::bytes::CaptureMatches'],
        ],
        [
          'impl&lt;\'r, \'h&gt; UnsafeUnpin for <a class="struct" href="regex/bytes/struct.Matches.html" title="struct regex::bytes::Matches">Matches</a>&lt;\'r, \'h&gt;',
          1,
          ['regex::regex::bytes::Matches'],
        ],
        [
          'impl&lt;\'r, \'h&gt; UnsafeUnpin for <a class="struct" href="regex/bytes/struct.Split.html" title="struct regex::bytes::Split">Split</a>&lt;\'r, \'h&gt;',
          1,
          ['regex::regex::bytes::Split'],
        ],
        [
          'impl&lt;\'r, \'h&gt; UnsafeUnpin for <a class="struct" href="regex/bytes/struct.SplitN.html" title="struct regex::bytes::SplitN">SplitN</a>&lt;\'r, \'h&gt;',
          1,
          ['regex::regex::bytes::SplitN'],
        ],
        [
          'impl&lt;\'r, \'h&gt; UnsafeUnpin for <a class="struct" href="regex/struct.CaptureMatches.html" title="struct regex::CaptureMatches">CaptureMatches</a>&lt;\'r, \'h&gt;',
          1,
          ['regex::regex::string::CaptureMatches'],
        ],
        [
          'impl&lt;\'r, \'h&gt; UnsafeUnpin for <a class="struct" href="regex/struct.Matches.html" title="struct regex::Matches">Matches</a>&lt;\'r, \'h&gt;',
          1,
          ['regex::regex::string::Matches'],
        ],
        [
          'impl&lt;\'r, \'h&gt; UnsafeUnpin for <a class="struct" href="regex/struct.Split.html" title="struct regex::Split">Split</a>&lt;\'r, \'h&gt;',
          1,
          ['regex::regex::string::Split'],
        ],
        [
          'impl&lt;\'r, \'h&gt; UnsafeUnpin for <a class="struct" href="regex/struct.SplitN.html" title="struct regex::SplitN">SplitN</a>&lt;\'r, \'h&gt;',
          1,
          ['regex::regex::string::SplitN'],
        ],
        [
          'impl&lt;\'s&gt; UnsafeUnpin for <a class="struct" href="regex/bytes/struct.NoExpand.html" title="struct regex::bytes::NoExpand">NoExpand</a>&lt;\'s&gt;',
          1,
          ['regex::regex::bytes::NoExpand'],
        ],
        [
          'impl&lt;\'s&gt; UnsafeUnpin for <a class="struct" href="regex/struct.NoExpand.html" title="struct regex::NoExpand">NoExpand</a>&lt;\'s&gt;',
          1,
          ['regex::regex::string::NoExpand'],
        ],
      ],
    ],
    [
      'regex_automata',
      [
        [
          'impl UnsafeUnpin for <a class="enum" href="regex_automata/enum.Anchored.html" title="enum regex_automata::Anchored">Anchored</a>',
          1,
          ['regex_automata::util::search::Anchored'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="regex_automata/enum.MatchErrorKind.html" title="enum regex_automata::MatchErrorKind">MatchErrorKind</a>',
          1,
          ['regex_automata::util::search::MatchErrorKind'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="regex_automata/enum.MatchKind.html" title="enum regex_automata::MatchKind">MatchKind</a>',
          1,
          ['regex_automata::util::search::MatchKind'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="regex_automata/hybrid/enum.StartError.html" title="enum regex_automata::hybrid::StartError">StartError</a>',
          1,
          ['regex_automata::hybrid::error::StartError'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="regex_automata/nfa/thompson/enum.State.html" title="enum regex_automata::nfa::thompson::State">State</a>',
          1,
          ['regex_automata::nfa::thompson::nfa::State'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="regex_automata/nfa/thompson/enum.WhichCaptures.html" title="enum regex_automata::nfa::thompson::WhichCaptures">WhichCaptures</a>',
          1,
          ['regex_automata::nfa::thompson::compiler::WhichCaptures'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="regex_automata/util/look/enum.Look.html" title="enum regex_automata::util::look::Look">Look</a>',
          1,
          ['regex_automata::util::look::Look'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/dfa/onepass/struct.BuildError.html" title="struct regex_automata::dfa::onepass::BuildError">BuildError</a>',
          1,
          ['regex_automata::dfa::onepass::BuildError'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/dfa/onepass/struct.Builder.html" title="struct regex_automata::dfa::onepass::Builder">Builder</a>',
          1,
          ['regex_automata::dfa::onepass::Builder'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/dfa/onepass/struct.Cache.html" title="struct regex_automata::dfa::onepass::Cache">Cache</a>',
          1,
          ['regex_automata::dfa::onepass::Cache'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/dfa/onepass/struct.Config.html" title="struct regex_automata::dfa::onepass::Config">Config</a>',
          1,
          ['regex_automata::dfa::onepass::Config'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/dfa/onepass/struct.DFA.html" title="struct regex_automata::dfa::onepass::DFA">DFA</a>',
          1,
          ['regex_automata::dfa::onepass::DFA'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/hybrid/dfa/struct.Builder.html" title="struct regex_automata::hybrid::dfa::Builder">Builder</a>',
          1,
          ['regex_automata::hybrid::dfa::Builder'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/hybrid/dfa/struct.Cache.html" title="struct regex_automata::hybrid::dfa::Cache">Cache</a>',
          1,
          ['regex_automata::hybrid::dfa::Cache'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/hybrid/dfa/struct.Config.html" title="struct regex_automata::hybrid::dfa::Config">Config</a>',
          1,
          ['regex_automata::hybrid::dfa::Config'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/hybrid/dfa/struct.DFA.html" title="struct regex_automata::hybrid::dfa::DFA">DFA</a>',
          1,
          ['regex_automata::hybrid::dfa::DFA'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/hybrid/dfa/struct.OverlappingState.html" title="struct regex_automata::hybrid::dfa::OverlappingState">OverlappingState</a>',
          1,
          ['regex_automata::hybrid::dfa::OverlappingState'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/hybrid/regex/struct.Builder.html" title="struct regex_automata::hybrid::regex::Builder">Builder</a>',
          1,
          ['regex_automata::hybrid::regex::Builder'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/hybrid/regex/struct.Cache.html" title="struct regex_automata::hybrid::regex::Cache">Cache</a>',
          1,
          ['regex_automata::hybrid::regex::Cache'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/hybrid/regex/struct.Regex.html" title="struct regex_automata::hybrid::regex::Regex">Regex</a>',
          1,
          ['regex_automata::hybrid::regex::Regex'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/hybrid/struct.BuildError.html" title="struct regex_automata::hybrid::BuildError">BuildError</a>',
          1,
          ['regex_automata::hybrid::error::BuildError'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/hybrid/struct.CacheError.html" title="struct regex_automata::hybrid::CacheError">CacheError</a>',
          1,
          ['regex_automata::hybrid::error::CacheError'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/hybrid/struct.LazyStateID.html" title="struct regex_automata::hybrid::LazyStateID">LazyStateID</a>',
          1,
          ['regex_automata::hybrid::id::LazyStateID'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/meta/struct.BuildError.html" title="struct regex_automata::meta::BuildError">BuildError</a>',
          1,
          ['regex_automata::meta::error::BuildError'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/meta/struct.Builder.html" title="struct regex_automata::meta::Builder">Builder</a>',
          1,
          ['regex_automata::meta::regex::Builder'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/meta/struct.Cache.html" title="struct regex_automata::meta::Cache">Cache</a>',
          1,
          ['regex_automata::meta::regex::Cache'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/meta/struct.Config.html" title="struct regex_automata::meta::Config">Config</a>',
          1,
          ['regex_automata::meta::regex::Config'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/meta/struct.Regex.html" title="struct regex_automata::meta::Regex">Regex</a>',
          1,
          ['regex_automata::meta::regex::Regex'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/nfa/thompson/backtrack/struct.BoundedBacktracker.html" title="struct regex_automata::nfa::thompson::backtrack::BoundedBacktracker">BoundedBacktracker</a>',
          1,
          ['regex_automata::nfa::thompson::backtrack::BoundedBacktracker'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/nfa/thompson/backtrack/struct.Builder.html" title="struct regex_automata::nfa::thompson::backtrack::Builder">Builder</a>',
          1,
          ['regex_automata::nfa::thompson::backtrack::Builder'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/nfa/thompson/backtrack/struct.Cache.html" title="struct regex_automata::nfa::thompson::backtrack::Cache">Cache</a>',
          1,
          ['regex_automata::nfa::thompson::backtrack::Cache'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/nfa/thompson/backtrack/struct.Config.html" title="struct regex_automata::nfa::thompson::backtrack::Config">Config</a>',
          1,
          ['regex_automata::nfa::thompson::backtrack::Config'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/nfa/thompson/pikevm/struct.Builder.html" title="struct regex_automata::nfa::thompson::pikevm::Builder">Builder</a>',
          1,
          ['regex_automata::nfa::thompson::pikevm::Builder'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/nfa/thompson/pikevm/struct.Cache.html" title="struct regex_automata::nfa::thompson::pikevm::Cache">Cache</a>',
          1,
          ['regex_automata::nfa::thompson::pikevm::Cache'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/nfa/thompson/pikevm/struct.Config.html" title="struct regex_automata::nfa::thompson::pikevm::Config">Config</a>',
          1,
          ['regex_automata::nfa::thompson::pikevm::Config'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/nfa/thompson/pikevm/struct.PikeVM.html" title="struct regex_automata::nfa::thompson::pikevm::PikeVM">PikeVM</a>',
          1,
          ['regex_automata::nfa::thompson::pikevm::PikeVM'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/nfa/thompson/struct.BuildError.html" title="struct regex_automata::nfa::thompson::BuildError">BuildError</a>',
          1,
          ['regex_automata::nfa::thompson::error::BuildError'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/nfa/thompson/struct.Builder.html" title="struct regex_automata::nfa::thompson::Builder">Builder</a>',
          1,
          ['regex_automata::nfa::thompson::builder::Builder'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/nfa/thompson/struct.Compiler.html" title="struct regex_automata::nfa::thompson::Compiler">Compiler</a>',
          1,
          ['regex_automata::nfa::thompson::compiler::Compiler'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/nfa/thompson/struct.Config.html" title="struct regex_automata::nfa::thompson::Config">Config</a>',
          1,
          ['regex_automata::nfa::thompson::compiler::Config'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/nfa/thompson/struct.DenseTransitions.html" title="struct regex_automata::nfa::thompson::DenseTransitions">DenseTransitions</a>',
          1,
          ['regex_automata::nfa::thompson::nfa::DenseTransitions'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/nfa/thompson/struct.NFA.html" title="struct regex_automata::nfa::thompson::NFA">NFA</a>',
          1,
          ['regex_automata::nfa::thompson::nfa::NFA'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/nfa/thompson/struct.SparseTransitions.html" title="struct regex_automata::nfa::thompson::SparseTransitions">SparseTransitions</a>',
          1,
          ['regex_automata::nfa::thompson::nfa::SparseTransitions'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/nfa/thompson/struct.Transition.html" title="struct regex_automata::nfa::thompson::Transition">Transition</a>',
          1,
          ['regex_automata::nfa::thompson::nfa::Transition'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/struct.HalfMatch.html" title="struct regex_automata::HalfMatch">HalfMatch</a>',
          1,
          ['regex_automata::util::search::HalfMatch'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/struct.Match.html" title="struct regex_automata::Match">Match</a>',
          1,
          ['regex_automata::util::search::Match'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/struct.MatchError.html" title="struct regex_automata::MatchError">MatchError</a>',
          1,
          ['regex_automata::util::search::MatchError'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/struct.PatternID.html" title="struct regex_automata::PatternID">PatternID</a>',
          1,
          ['regex_automata::util::primitives::PatternID'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/struct.PatternSet.html" title="struct regex_automata::PatternSet">PatternSet</a>',
          1,
          ['regex_automata::util::search::PatternSet'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/struct.PatternSetInsertError.html" title="struct regex_automata::PatternSetInsertError">PatternSetInsertError</a>',
          1,
          ['regex_automata::util::search::PatternSetInsertError'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/struct.Span.html" title="struct regex_automata::Span">Span</a>',
          1,
          ['regex_automata::util::search::Span'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/util/alphabet/struct.ByteClasses.html" title="struct regex_automata::util::alphabet::ByteClasses">ByteClasses</a>',
          1,
          ['regex_automata::util::alphabet::ByteClasses'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/util/alphabet/struct.Unit.html" title="struct regex_automata::util::alphabet::Unit">Unit</a>',
          1,
          ['regex_automata::util::alphabet::Unit'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/util/captures/struct.Captures.html" title="struct regex_automata::util::captures::Captures">Captures</a>',
          1,
          ['regex_automata::util::captures::Captures'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/util/captures/struct.GroupInfo.html" title="struct regex_automata::util::captures::GroupInfo">GroupInfo</a>',
          1,
          ['regex_automata::util::captures::GroupInfo'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/util/captures/struct.GroupInfoError.html" title="struct regex_automata::util::captures::GroupInfoError">GroupInfoError</a>',
          1,
          ['regex_automata::util::captures::GroupInfoError'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/util/escape/struct.DebugByte.html" title="struct regex_automata::util::escape::DebugByte">DebugByte</a>',
          1,
          ['regex_automata::util::escape::DebugByte'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/util/look/struct.LookMatcher.html" title="struct regex_automata::util::look::LookMatcher">LookMatcher</a>',
          1,
          ['regex_automata::util::look::LookMatcher'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/util/look/struct.LookSet.html" title="struct regex_automata::util::look::LookSet">LookSet</a>',
          1,
          ['regex_automata::util::look::LookSet'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/util/look/struct.LookSetIter.html" title="struct regex_automata::util::look::LookSetIter">LookSetIter</a>',
          1,
          ['regex_automata::util::look::LookSetIter'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/util/look/struct.UnicodeWordBoundaryError.html" title="struct regex_automata::util::look::UnicodeWordBoundaryError">UnicodeWordBoundaryError</a>',
          1,
          ['regex_automata::util::look::UnicodeWordBoundaryError'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/util/prefilter/struct.Prefilter.html" title="struct regex_automata::util::prefilter::Prefilter">Prefilter</a>',
          1,
          ['regex_automata::util::prefilter::Prefilter'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/util/primitives/struct.NonMaxUsize.html" title="struct regex_automata::util::primitives::NonMaxUsize">NonMaxUsize</a>',
          1,
          ['regex_automata::util::primitives::NonMaxUsize'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/util/primitives/struct.PatternIDError.html" title="struct regex_automata::util::primitives::PatternIDError">PatternIDError</a>',
          1,
          ['regex_automata::util::primitives::PatternIDError'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/util/primitives/struct.SmallIndex.html" title="struct regex_automata::util::primitives::SmallIndex">SmallIndex</a>',
          1,
          ['regex_automata::util::primitives::SmallIndex'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/util/primitives/struct.SmallIndexError.html" title="struct regex_automata::util::primitives::SmallIndexError">SmallIndexError</a>',
          1,
          ['regex_automata::util::primitives::SmallIndexError'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/util/primitives/struct.StateID.html" title="struct regex_automata::util::primitives::StateID">StateID</a>',
          1,
          ['regex_automata::util::primitives::StateID'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/util/primitives/struct.StateIDError.html" title="struct regex_automata::util::primitives::StateIDError">StateIDError</a>',
          1,
          ['regex_automata::util::primitives::StateIDError'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/util/start/struct.Config.html" title="struct regex_automata::util::start::Config">Config</a>',
          1,
          ['regex_automata::util::start::Config'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/util/syntax/struct.Config.html" title="struct regex_automata::util::syntax::Config">Config</a>',
          1,
          ['regex_automata::util::syntax::Config'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/util/wire/struct.DeserializeError.html" title="struct regex_automata::util::wire::DeserializeError">DeserializeError</a>',
          1,
          ['regex_automata::util::wire::DeserializeError'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_automata/util/wire/struct.SerializeError.html" title="struct regex_automata::util::wire::SerializeError">SerializeError</a>',
          1,
          ['regex_automata::util::wire::SerializeError'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="regex_automata/nfa/thompson/struct.PatternIter.html" title="struct regex_automata::nfa::thompson::PatternIter">PatternIter</a>&lt;\'a&gt;',
          1,
          ['regex_automata::nfa::thompson::nfa::PatternIter'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="regex_automata/struct.PatternSetIter.html" title="struct regex_automata::PatternSetIter">PatternSetIter</a>&lt;\'a&gt;',
          1,
          ['regex_automata::util::search::PatternSetIter'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="regex_automata/util/alphabet/struct.ByteClassElements.html" title="struct regex_automata::util::alphabet::ByteClassElements">ByteClassElements</a>&lt;\'a&gt;',
          1,
          ['regex_automata::util::alphabet::ByteClassElements'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="regex_automata/util/alphabet/struct.ByteClassIter.html" title="struct regex_automata::util::alphabet::ByteClassIter">ByteClassIter</a>&lt;\'a&gt;',
          1,
          ['regex_automata::util::alphabet::ByteClassIter'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="regex_automata/util/alphabet/struct.ByteClassRepresentatives.html" title="struct regex_automata::util::alphabet::ByteClassRepresentatives">ByteClassRepresentatives</a>&lt;\'a&gt;',
          1,
          ['regex_automata::util::alphabet::ByteClassRepresentatives'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="regex_automata/util/captures/struct.CapturesPatternIter.html" title="struct regex_automata::util::captures::CapturesPatternIter">CapturesPatternIter</a>&lt;\'a&gt;',
          1,
          ['regex_automata::util::captures::CapturesPatternIter'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="regex_automata/util/captures/struct.GroupInfoAllNames.html" title="struct regex_automata::util::captures::GroupInfoAllNames">GroupInfoAllNames</a>&lt;\'a&gt;',
          1,
          ['regex_automata::util::captures::GroupInfoAllNames'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="regex_automata/util/captures/struct.GroupInfoPatternNames.html" title="struct regex_automata::util::captures::GroupInfoPatternNames">GroupInfoPatternNames</a>&lt;\'a&gt;',
          1,
          ['regex_automata::util::captures::GroupInfoPatternNames'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="regex_automata/util/escape/struct.DebugHaystack.html" title="struct regex_automata::util::escape::DebugHaystack">DebugHaystack</a>&lt;\'a&gt;',
          1,
          ['regex_automata::util::escape::DebugHaystack'],
        ],
        [
          'impl&lt;\'a, T, F&gt; UnsafeUnpin for <a class="struct" href="regex_automata/util/pool/struct.PoolGuard.html" title="struct regex_automata::util::pool::PoolGuard">PoolGuard</a>&lt;\'a, T, F&gt;',
          1,
          ['regex_automata::util::pool::PoolGuard'],
        ],
        [
          'impl&lt;\'h&gt; UnsafeUnpin for <a class="struct" href="regex_automata/struct.Input.html" title="struct regex_automata::Input">Input</a>&lt;\'h&gt;',
          1,
          ['regex_automata::util::search::Input'],
        ],
        [
          'impl&lt;\'h&gt; UnsafeUnpin for <a class="struct" href="regex_automata/util/iter/struct.Searcher.html" title="struct regex_automata::util::iter::Searcher">Searcher</a>&lt;\'h&gt;',
          1,
          ['regex_automata::util::iter::Searcher'],
        ],
        [
          'impl&lt;\'h, F&gt; UnsafeUnpin for <a class="struct" href="regex_automata/util/iter/struct.CapturesIter.html" title="struct regex_automata::util::iter::CapturesIter">CapturesIter</a>&lt;\'h, F&gt;<div class="where">where\n    F: UnsafeUnpin,</div>',
          1,
          ['regex_automata::util::iter::CapturesIter'],
        ],
        [
          'impl&lt;\'h, F&gt; UnsafeUnpin for <a class="struct" href="regex_automata/util/iter/struct.HalfMatchesIter.html" title="struct regex_automata::util::iter::HalfMatchesIter">HalfMatchesIter</a>&lt;\'h, F&gt;<div class="where">where\n    F: UnsafeUnpin,</div>',
          1,
          ['regex_automata::util::iter::HalfMatchesIter'],
        ],
        [
          'impl&lt;\'h, F&gt; UnsafeUnpin for <a class="struct" href="regex_automata/util/iter/struct.MatchesIter.html" title="struct regex_automata::util::iter::MatchesIter">MatchesIter</a>&lt;\'h, F&gt;<div class="where">where\n    F: UnsafeUnpin,</div>',
          1,
          ['regex_automata::util::iter::MatchesIter'],
        ],
        [
          'impl&lt;\'h, F&gt; UnsafeUnpin for <a class="struct" href="regex_automata/util/iter/struct.TryCapturesIter.html" title="struct regex_automata::util::iter::TryCapturesIter">TryCapturesIter</a>&lt;\'h, F&gt;<div class="where">where\n    F: UnsafeUnpin,</div>',
          1,
          ['regex_automata::util::iter::TryCapturesIter'],
        ],
        [
          'impl&lt;\'h, F&gt; UnsafeUnpin for <a class="struct" href="regex_automata/util/iter/struct.TryHalfMatchesIter.html" title="struct regex_automata::util::iter::TryHalfMatchesIter">TryHalfMatchesIter</a>&lt;\'h, F&gt;<div class="where">where\n    F: UnsafeUnpin,</div>',
          1,
          ['regex_automata::util::iter::TryHalfMatchesIter'],
        ],
        [
          'impl&lt;\'h, F&gt; UnsafeUnpin for <a class="struct" href="regex_automata/util/iter/struct.TryMatchesIter.html" title="struct regex_automata::util::iter::TryMatchesIter">TryMatchesIter</a>&lt;\'h, F&gt;<div class="where">where\n    F: UnsafeUnpin,</div>',
          1,
          ['regex_automata::util::iter::TryMatchesIter'],
        ],
        [
          'impl&lt;\'r, \'c, \'h&gt; UnsafeUnpin for <a class="struct" href="regex_automata/hybrid/regex/struct.FindMatches.html" title="struct regex_automata::hybrid::regex::FindMatches">FindMatches</a>&lt;\'r, \'c, \'h&gt;',
          1,
          ['regex_automata::hybrid::regex::FindMatches'],
        ],
        [
          'impl&lt;\'r, \'c, \'h&gt; UnsafeUnpin for <a class="struct" href="regex_automata/nfa/thompson/backtrack/struct.TryCapturesMatches.html" title="struct regex_automata::nfa::thompson::backtrack::TryCapturesMatches">TryCapturesMatches</a>&lt;\'r, \'c, \'h&gt;',
          1,
          ['regex_automata::nfa::thompson::backtrack::TryCapturesMatches'],
        ],
        [
          'impl&lt;\'r, \'c, \'h&gt; UnsafeUnpin for <a class="struct" href="regex_automata/nfa/thompson/backtrack/struct.TryFindMatches.html" title="struct regex_automata::nfa::thompson::backtrack::TryFindMatches">TryFindMatches</a>&lt;\'r, \'c, \'h&gt;',
          1,
          ['regex_automata::nfa::thompson::backtrack::TryFindMatches'],
        ],
        [
          'impl&lt;\'r, \'c, \'h&gt; UnsafeUnpin for <a class="struct" href="regex_automata/nfa/thompson/pikevm/struct.CapturesMatches.html" title="struct regex_automata::nfa::thompson::pikevm::CapturesMatches">CapturesMatches</a>&lt;\'r, \'c, \'h&gt;',
          1,
          ['regex_automata::nfa::thompson::pikevm::CapturesMatches'],
        ],
        [
          'impl&lt;\'r, \'c, \'h&gt; UnsafeUnpin for <a class="struct" href="regex_automata/nfa/thompson/pikevm/struct.FindMatches.html" title="struct regex_automata::nfa::thompson::pikevm::FindMatches">FindMatches</a>&lt;\'r, \'c, \'h&gt;',
          1,
          ['regex_automata::nfa::thompson::pikevm::FindMatches'],
        ],
        [
          'impl&lt;\'r, \'h&gt; UnsafeUnpin for <a class="struct" href="regex_automata/meta/struct.CapturesMatches.html" title="struct regex_automata::meta::CapturesMatches">CapturesMatches</a>&lt;\'r, \'h&gt;',
          1,
          ['regex_automata::meta::regex::CapturesMatches'],
        ],
        [
          'impl&lt;\'r, \'h&gt; UnsafeUnpin for <a class="struct" href="regex_automata/meta/struct.FindMatches.html" title="struct regex_automata::meta::FindMatches">FindMatches</a>&lt;\'r, \'h&gt;',
          1,
          ['regex_automata::meta::regex::FindMatches'],
        ],
        [
          'impl&lt;\'r, \'h&gt; UnsafeUnpin for <a class="struct" href="regex_automata/meta/struct.Split.html" title="struct regex_automata::meta::Split">Split</a>&lt;\'r, \'h&gt;',
          1,
          ['regex_automata::meta::regex::Split'],
        ],
        [
          'impl&lt;\'r, \'h&gt; UnsafeUnpin for <a class="struct" href="regex_automata/meta/struct.SplitN.html" title="struct regex_automata::meta::SplitN">SplitN</a>&lt;\'r, \'h&gt;',
          1,
          ['regex_automata::meta::regex::SplitN'],
        ],
        [
          'impl&lt;B, T&gt; UnsafeUnpin for <a class="struct" href="regex_automata/util/wire/struct.AlignAs.html" title="struct regex_automata::util::wire::AlignAs">AlignAs</a>&lt;B, T&gt;<div class="where">where\n    B: UnsafeUnpin + ?<a class="trait" href="https://doc.rust-lang.org/nightly/core/marker/trait.Sized.html" title="trait core::marker::Sized">Sized</a>,\n    T: UnsafeUnpin,</div>',
          1,
          ['regex_automata::util::wire::AlignAs'],
        ],
        [
          'impl&lt;T, F&gt; UnsafeUnpin for <a class="struct" href="regex_automata/util/lazy/struct.Lazy.html" title="struct regex_automata::util::lazy::Lazy">Lazy</a>&lt;T, F&gt;<div class="where">where\n    F: UnsafeUnpin,</div>',
          1,
          ['regex_automata::util::lazy::Lazy'],
        ],
        [
          'impl&lt;T, F&gt; UnsafeUnpin for <a class="struct" href="regex_automata/util/pool/struct.Pool.html" title="struct regex_automata::util::pool::Pool">Pool</a>&lt;T, F&gt;',
          1,
          ['regex_automata::util::pool::Pool'],
        ],
      ],
    ],
    [
      'regex_syntax',
      [
        [
          'impl UnsafeUnpin for <a class="enum" href="regex_syntax/ast/enum.AssertionKind.html" title="enum regex_syntax::ast::AssertionKind">AssertionKind</a>',
          1,
          ['regex_syntax::ast::AssertionKind'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="regex_syntax/ast/enum.Ast.html" title="enum regex_syntax::ast::Ast">Ast</a>',
          1,
          ['regex_syntax::ast::Ast'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="regex_syntax/ast/enum.ClassAsciiKind.html" title="enum regex_syntax::ast::ClassAsciiKind">ClassAsciiKind</a>',
          1,
          ['regex_syntax::ast::ClassAsciiKind'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="regex_syntax/ast/enum.ClassPerlKind.html" title="enum regex_syntax::ast::ClassPerlKind">ClassPerlKind</a>',
          1,
          ['regex_syntax::ast::ClassPerlKind'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="regex_syntax/ast/enum.ClassSet.html" title="enum regex_syntax::ast::ClassSet">ClassSet</a>',
          1,
          ['regex_syntax::ast::ClassSet'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="regex_syntax/ast/enum.ClassSetBinaryOpKind.html" title="enum regex_syntax::ast::ClassSetBinaryOpKind">ClassSetBinaryOpKind</a>',
          1,
          ['regex_syntax::ast::ClassSetBinaryOpKind'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="regex_syntax/ast/enum.ClassSetItem.html" title="enum regex_syntax::ast::ClassSetItem">ClassSetItem</a>',
          1,
          ['regex_syntax::ast::ClassSetItem'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="regex_syntax/ast/enum.ClassUnicodeKind.html" title="enum regex_syntax::ast::ClassUnicodeKind">ClassUnicodeKind</a>',
          1,
          ['regex_syntax::ast::ClassUnicodeKind'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="regex_syntax/ast/enum.ClassUnicodeOpKind.html" title="enum regex_syntax::ast::ClassUnicodeOpKind">ClassUnicodeOpKind</a>',
          1,
          ['regex_syntax::ast::ClassUnicodeOpKind'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="regex_syntax/ast/enum.ErrorKind.html" title="enum regex_syntax::ast::ErrorKind">ErrorKind</a>',
          1,
          ['regex_syntax::ast::ErrorKind'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="regex_syntax/ast/enum.Flag.html" title="enum regex_syntax::ast::Flag">Flag</a>',
          1,
          ['regex_syntax::ast::Flag'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="regex_syntax/ast/enum.FlagsItemKind.html" title="enum regex_syntax::ast::FlagsItemKind">FlagsItemKind</a>',
          1,
          ['regex_syntax::ast::FlagsItemKind'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="regex_syntax/ast/enum.GroupKind.html" title="enum regex_syntax::ast::GroupKind">GroupKind</a>',
          1,
          ['regex_syntax::ast::GroupKind'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="regex_syntax/ast/enum.HexLiteralKind.html" title="enum regex_syntax::ast::HexLiteralKind">HexLiteralKind</a>',
          1,
          ['regex_syntax::ast::HexLiteralKind'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="regex_syntax/ast/enum.LiteralKind.html" title="enum regex_syntax::ast::LiteralKind">LiteralKind</a>',
          1,
          ['regex_syntax::ast::LiteralKind'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="regex_syntax/ast/enum.RepetitionKind.html" title="enum regex_syntax::ast::RepetitionKind">RepetitionKind</a>',
          1,
          ['regex_syntax::ast::RepetitionKind'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="regex_syntax/ast/enum.RepetitionRange.html" title="enum regex_syntax::ast::RepetitionRange">RepetitionRange</a>',
          1,
          ['regex_syntax::ast::RepetitionRange'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="regex_syntax/ast/enum.SpecialLiteralKind.html" title="enum regex_syntax::ast::SpecialLiteralKind">SpecialLiteralKind</a>',
          1,
          ['regex_syntax::ast::SpecialLiteralKind'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="regex_syntax/enum.Error.html" title="enum regex_syntax::Error">Error</a>',
          1,
          ['regex_syntax::error::Error'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="regex_syntax/hir/enum.Class.html" title="enum regex_syntax::hir::Class">Class</a>',
          1,
          ['regex_syntax::hir::Class'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="regex_syntax/hir/enum.Dot.html" title="enum regex_syntax::hir::Dot">Dot</a>',
          1,
          ['regex_syntax::hir::Dot'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="regex_syntax/hir/enum.ErrorKind.html" title="enum regex_syntax::hir::ErrorKind">ErrorKind</a>',
          1,
          ['regex_syntax::hir::ErrorKind'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="regex_syntax/hir/enum.HirKind.html" title="enum regex_syntax::hir::HirKind">HirKind</a>',
          1,
          ['regex_syntax::hir::HirKind'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="regex_syntax/hir/enum.Look.html" title="enum regex_syntax::hir::Look">Look</a>',
          1,
          ['regex_syntax::hir::Look'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="regex_syntax/hir/literal/enum.ExtractKind.html" title="enum regex_syntax::hir::literal::ExtractKind">ExtractKind</a>',
          1,
          ['regex_syntax::hir::literal::ExtractKind'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="regex_syntax/utf8/enum.Utf8Sequence.html" title="enum regex_syntax::utf8::Utf8Sequence">Utf8Sequence</a>',
          1,
          ['regex_syntax::utf8::Utf8Sequence'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/ast/parse/struct.Parser.html" title="struct regex_syntax::ast::parse::Parser">Parser</a>',
          1,
          ['regex_syntax::ast::parse::Parser'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/ast/parse/struct.ParserBuilder.html" title="struct regex_syntax::ast::parse::ParserBuilder">ParserBuilder</a>',
          1,
          ['regex_syntax::ast::parse::ParserBuilder'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/ast/print/struct.Printer.html" title="struct regex_syntax::ast::print::Printer">Printer</a>',
          1,
          ['regex_syntax::ast::print::Printer'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/ast/struct.Alternation.html" title="struct regex_syntax::ast::Alternation">Alternation</a>',
          1,
          ['regex_syntax::ast::Alternation'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/ast/struct.Assertion.html" title="struct regex_syntax::ast::Assertion">Assertion</a>',
          1,
          ['regex_syntax::ast::Assertion'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/ast/struct.CaptureName.html" title="struct regex_syntax::ast::CaptureName">CaptureName</a>',
          1,
          ['regex_syntax::ast::CaptureName'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/ast/struct.ClassAscii.html" title="struct regex_syntax::ast::ClassAscii">ClassAscii</a>',
          1,
          ['regex_syntax::ast::ClassAscii'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/ast/struct.ClassBracketed.html" title="struct regex_syntax::ast::ClassBracketed">ClassBracketed</a>',
          1,
          ['regex_syntax::ast::ClassBracketed'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/ast/struct.ClassPerl.html" title="struct regex_syntax::ast::ClassPerl">ClassPerl</a>',
          1,
          ['regex_syntax::ast::ClassPerl'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/ast/struct.ClassSetBinaryOp.html" title="struct regex_syntax::ast::ClassSetBinaryOp">ClassSetBinaryOp</a>',
          1,
          ['regex_syntax::ast::ClassSetBinaryOp'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/ast/struct.ClassSetRange.html" title="struct regex_syntax::ast::ClassSetRange">ClassSetRange</a>',
          1,
          ['regex_syntax::ast::ClassSetRange'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/ast/struct.ClassSetUnion.html" title="struct regex_syntax::ast::ClassSetUnion">ClassSetUnion</a>',
          1,
          ['regex_syntax::ast::ClassSetUnion'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/ast/struct.ClassUnicode.html" title="struct regex_syntax::ast::ClassUnicode">ClassUnicode</a>',
          1,
          ['regex_syntax::ast::ClassUnicode'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/ast/struct.Comment.html" title="struct regex_syntax::ast::Comment">Comment</a>',
          1,
          ['regex_syntax::ast::Comment'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/ast/struct.Concat.html" title="struct regex_syntax::ast::Concat">Concat</a>',
          1,
          ['regex_syntax::ast::Concat'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/ast/struct.Error.html" title="struct regex_syntax::ast::Error">Error</a>',
          1,
          ['regex_syntax::ast::Error'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/ast/struct.Flags.html" title="struct regex_syntax::ast::Flags">Flags</a>',
          1,
          ['regex_syntax::ast::Flags'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/ast/struct.FlagsItem.html" title="struct regex_syntax::ast::FlagsItem">FlagsItem</a>',
          1,
          ['regex_syntax::ast::FlagsItem'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/ast/struct.Group.html" title="struct regex_syntax::ast::Group">Group</a>',
          1,
          ['regex_syntax::ast::Group'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/ast/struct.Literal.html" title="struct regex_syntax::ast::Literal">Literal</a>',
          1,
          ['regex_syntax::ast::Literal'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/ast/struct.Position.html" title="struct regex_syntax::ast::Position">Position</a>',
          1,
          ['regex_syntax::ast::Position'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/ast/struct.Repetition.html" title="struct regex_syntax::ast::Repetition">Repetition</a>',
          1,
          ['regex_syntax::ast::Repetition'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/ast/struct.RepetitionOp.html" title="struct regex_syntax::ast::RepetitionOp">RepetitionOp</a>',
          1,
          ['regex_syntax::ast::RepetitionOp'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/ast/struct.SetFlags.html" title="struct regex_syntax::ast::SetFlags">SetFlags</a>',
          1,
          ['regex_syntax::ast::SetFlags'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/ast/struct.Span.html" title="struct regex_syntax::ast::Span">Span</a>',
          1,
          ['regex_syntax::ast::Span'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/ast/struct.WithComments.html" title="struct regex_syntax::ast::WithComments">WithComments</a>',
          1,
          ['regex_syntax::ast::WithComments'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/hir/literal/struct.Extractor.html" title="struct regex_syntax::hir::literal::Extractor">Extractor</a>',
          1,
          ['regex_syntax::hir::literal::Extractor'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/hir/literal/struct.Literal.html" title="struct regex_syntax::hir::literal::Literal">Literal</a>',
          1,
          ['regex_syntax::hir::literal::Literal'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/hir/literal/struct.Seq.html" title="struct regex_syntax::hir::literal::Seq">Seq</a>',
          1,
          ['regex_syntax::hir::literal::Seq'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/hir/print/struct.Printer.html" title="struct regex_syntax::hir::print::Printer">Printer</a>',
          1,
          ['regex_syntax::hir::print::Printer'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/hir/struct.Capture.html" title="struct regex_syntax::hir::Capture">Capture</a>',
          1,
          ['regex_syntax::hir::Capture'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/hir/struct.CaseFoldError.html" title="struct regex_syntax::hir::CaseFoldError">CaseFoldError</a>',
          1,
          ['regex_syntax::unicode::CaseFoldError'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/hir/struct.ClassBytes.html" title="struct regex_syntax::hir::ClassBytes">ClassBytes</a>',
          1,
          ['regex_syntax::hir::ClassBytes'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/hir/struct.ClassBytesRange.html" title="struct regex_syntax::hir::ClassBytesRange">ClassBytesRange</a>',
          1,
          ['regex_syntax::hir::ClassBytesRange'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/hir/struct.ClassUnicode.html" title="struct regex_syntax::hir::ClassUnicode">ClassUnicode</a>',
          1,
          ['regex_syntax::hir::ClassUnicode'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/hir/struct.ClassUnicodeRange.html" title="struct regex_syntax::hir::ClassUnicodeRange">ClassUnicodeRange</a>',
          1,
          ['regex_syntax::hir::ClassUnicodeRange'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/hir/struct.Error.html" title="struct regex_syntax::hir::Error">Error</a>',
          1,
          ['regex_syntax::hir::Error'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/hir/struct.Hir.html" title="struct regex_syntax::hir::Hir">Hir</a>',
          1,
          ['regex_syntax::hir::Hir'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/hir/struct.Literal.html" title="struct regex_syntax::hir::Literal">Literal</a>',
          1,
          ['regex_syntax::hir::Literal'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/hir/struct.LookSet.html" title="struct regex_syntax::hir::LookSet">LookSet</a>',
          1,
          ['regex_syntax::hir::LookSet'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/hir/struct.LookSetIter.html" title="struct regex_syntax::hir::LookSetIter">LookSetIter</a>',
          1,
          ['regex_syntax::hir::LookSetIter'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/hir/struct.Properties.html" title="struct regex_syntax::hir::Properties">Properties</a>',
          1,
          ['regex_syntax::hir::Properties'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/hir/struct.Repetition.html" title="struct regex_syntax::hir::Repetition">Repetition</a>',
          1,
          ['regex_syntax::hir::Repetition'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/hir/translate/struct.Translator.html" title="struct regex_syntax::hir::translate::Translator">Translator</a>',
          1,
          ['regex_syntax::hir::translate::Translator'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/hir/translate/struct.TranslatorBuilder.html" title="struct regex_syntax::hir::translate::TranslatorBuilder">TranslatorBuilder</a>',
          1,
          ['regex_syntax::hir::translate::TranslatorBuilder'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/struct.Parser.html" title="struct regex_syntax::Parser">Parser</a>',
          1,
          ['regex_syntax::parser::Parser'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/struct.ParserBuilder.html" title="struct regex_syntax::ParserBuilder">ParserBuilder</a>',
          1,
          ['regex_syntax::parser::ParserBuilder'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/struct.UnicodeWordError.html" title="struct regex_syntax::UnicodeWordError">UnicodeWordError</a>',
          1,
          ['regex_syntax::unicode::UnicodeWordError'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/utf8/struct.Utf8Range.html" title="struct regex_syntax::utf8::Utf8Range">Utf8Range</a>',
          1,
          ['regex_syntax::utf8::Utf8Range'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="regex_syntax/utf8/struct.Utf8Sequences.html" title="struct regex_syntax::utf8::Utf8Sequences">Utf8Sequences</a>',
          1,
          ['regex_syntax::utf8::Utf8Sequences'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="regex_syntax/hir/struct.ClassBytesIter.html" title="struct regex_syntax::hir::ClassBytesIter">ClassBytesIter</a>&lt;\'a&gt;',
          1,
          ['regex_syntax::hir::ClassBytesIter'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="regex_syntax/hir/struct.ClassUnicodeIter.html" title="struct regex_syntax::hir::ClassUnicodeIter">ClassUnicodeIter</a>&lt;\'a&gt;',
          1,
          ['regex_syntax::hir::ClassUnicodeIter'],
        ],
      ],
    ],
    [
      'ryu',
      [
        [
          'impl UnsafeUnpin for <a class="struct" href="ryu/struct.Buffer.html" title="struct ryu::Buffer">Buffer</a>',
          1,
          ['ryu::buffer::Buffer'],
        ],
      ],
    ],
    [
      'semver',
      [
        [
          'impl UnsafeUnpin for <a class="enum" href="semver/enum.Op.html" title="enum semver::Op">Op</a>',
          1,
          ['semver::Op'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="semver/struct.BuildMetadata.html" title="struct semver::BuildMetadata">BuildMetadata</a>',
          1,
          ['semver::BuildMetadata'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="semver/struct.Comparator.html" title="struct semver::Comparator">Comparator</a>',
          1,
          ['semver::Comparator'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="semver/struct.Error.html" title="struct semver::Error">Error</a>',
          1,
          ['semver::parse::Error'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="semver/struct.Prerelease.html" title="struct semver::Prerelease">Prerelease</a>',
          1,
          ['semver::Prerelease'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="semver/struct.Version.html" title="struct semver::Version">Version</a>',
          1,
          ['semver::Version'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="semver/struct.VersionReq.html" title="struct semver::VersionReq">VersionReq</a>',
          1,
          ['semver::VersionReq'],
        ],
      ],
    ],
    [
      'serde',
      [
        [
          'impl UnsafeUnpin for <a class="struct" href="serde/de/struct.IgnoredAny.html" title="struct serde::de::IgnoredAny">IgnoredAny</a>',
          1,
          ['serde::de::ignored_any::IgnoredAny'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="serde/de/value/struct.Error.html" title="struct serde::de::value::Error">Error</a>',
          1,
          ['serde::de::value::Error'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="enum" href="serde/de/enum.Unexpected.html" title="enum serde::de::Unexpected">Unexpected</a>&lt;\'a&gt;',
          1,
          ['serde::de::Unexpected'],
        ],
        [
          'impl&lt;\'a, E&gt; UnsafeUnpin for <a class="struct" href="serde/de/value/struct.BytesDeserializer.html" title="struct serde::de::value::BytesDeserializer">BytesDeserializer</a>&lt;\'a, E&gt;',
          1,
          ['serde::de::value::BytesDeserializer'],
        ],
        [
          'impl&lt;\'a, E&gt; UnsafeUnpin for <a class="struct" href="serde/de/value/struct.CowStrDeserializer.html" title="struct serde::de::value::CowStrDeserializer">CowStrDeserializer</a>&lt;\'a, E&gt;',
          1,
          ['serde::de::value::CowStrDeserializer'],
        ],
        [
          'impl&lt;\'a, E&gt; UnsafeUnpin for <a class="struct" href="serde/de/value/struct.StrDeserializer.html" title="struct serde::de::value::StrDeserializer">StrDeserializer</a>&lt;\'a, E&gt;',
          1,
          ['serde::de::value::StrDeserializer'],
        ],
        [
          'impl&lt;\'de, E&gt; UnsafeUnpin for <a class="struct" href="serde/de/value/struct.BorrowedBytesDeserializer.html" title="struct serde::de::value::BorrowedBytesDeserializer">BorrowedBytesDeserializer</a>&lt;\'de, E&gt;',
          1,
          ['serde::de::value::BorrowedBytesDeserializer'],
        ],
        [
          'impl&lt;\'de, E&gt; UnsafeUnpin for <a class="struct" href="serde/de/value/struct.BorrowedStrDeserializer.html" title="struct serde::de::value::BorrowedStrDeserializer">BorrowedStrDeserializer</a>&lt;\'de, E&gt;',
          1,
          ['serde::de::value::BorrowedStrDeserializer'],
        ],
        [
          'impl&lt;\'de, I, E&gt; UnsafeUnpin for <a class="struct" href="serde/de/value/struct.MapDeserializer.html" title="struct serde::de::value::MapDeserializer">MapDeserializer</a>&lt;\'de, I, E&gt;<div class="where">where\n    &lt;&lt;I as <a class="trait" href="https://doc.rust-lang.org/nightly/core/iter/traits/iterator/trait.Iterator.html" title="trait core::iter::traits::iterator::Iterator">Iterator</a>&gt;::<a class="associatedtype" href="https://doc.rust-lang.org/nightly/core/iter/traits/iterator/trait.Iterator.html#associatedtype.Item" title="type core::iter::traits::iterator::Iterator::Item">Item</a> as Pair&gt;::Second: UnsafeUnpin,\n    I: UnsafeUnpin,</div>',
          1,
          ['serde::de::value::MapDeserializer'],
        ],
        [
          'impl&lt;A&gt; UnsafeUnpin for <a class="struct" href="serde/de/value/struct.EnumAccessDeserializer.html" title="struct serde::de::value::EnumAccessDeserializer">EnumAccessDeserializer</a>&lt;A&gt;<div class="where">where\n    A: UnsafeUnpin,</div>',
          1,
          ['serde::de::value::EnumAccessDeserializer'],
        ],
        [
          'impl&lt;A&gt; UnsafeUnpin for <a class="struct" href="serde/de/value/struct.MapAccessDeserializer.html" title="struct serde::de::value::MapAccessDeserializer">MapAccessDeserializer</a>&lt;A&gt;<div class="where">where\n    A: UnsafeUnpin,</div>',
          1,
          ['serde::de::value::MapAccessDeserializer'],
        ],
        [
          'impl&lt;A&gt; UnsafeUnpin for <a class="struct" href="serde/de/value/struct.SeqAccessDeserializer.html" title="struct serde::de::value::SeqAccessDeserializer">SeqAccessDeserializer</a>&lt;A&gt;<div class="where">where\n    A: UnsafeUnpin,</div>',
          1,
          ['serde::de::value::SeqAccessDeserializer'],
        ],
        [
          'impl&lt;E&gt; UnsafeUnpin for <a class="struct" href="serde/de/value/struct.BoolDeserializer.html" title="struct serde::de::value::BoolDeserializer">BoolDeserializer</a>&lt;E&gt;',
          1,
          ['serde::de::value::BoolDeserializer'],
        ],
        [
          'impl&lt;E&gt; UnsafeUnpin for <a class="struct" href="serde/de/value/struct.CharDeserializer.html" title="struct serde::de::value::CharDeserializer">CharDeserializer</a>&lt;E&gt;',
          1,
          ['serde::de::value::CharDeserializer'],
        ],
        [
          'impl&lt;E&gt; UnsafeUnpin for <a class="struct" href="serde/de/value/struct.F32Deserializer.html" title="struct serde::de::value::F32Deserializer">F32Deserializer</a>&lt;E&gt;',
          1,
          ['serde::de::value::F32Deserializer'],
        ],
        [
          'impl&lt;E&gt; UnsafeUnpin for <a class="struct" href="serde/de/value/struct.F64Deserializer.html" title="struct serde::de::value::F64Deserializer">F64Deserializer</a>&lt;E&gt;',
          1,
          ['serde::de::value::F64Deserializer'],
        ],
        [
          'impl&lt;E&gt; UnsafeUnpin for <a class="struct" href="serde/de/value/struct.I128Deserializer.html" title="struct serde::de::value::I128Deserializer">I128Deserializer</a>&lt;E&gt;',
          1,
          ['serde::de::value::I128Deserializer'],
        ],
        [
          'impl&lt;E&gt; UnsafeUnpin for <a class="struct" href="serde/de/value/struct.I16Deserializer.html" title="struct serde::de::value::I16Deserializer">I16Deserializer</a>&lt;E&gt;',
          1,
          ['serde::de::value::I16Deserializer'],
        ],
        [
          'impl&lt;E&gt; UnsafeUnpin for <a class="struct" href="serde/de/value/struct.I32Deserializer.html" title="struct serde::de::value::I32Deserializer">I32Deserializer</a>&lt;E&gt;',
          1,
          ['serde::de::value::I32Deserializer'],
        ],
        [
          'impl&lt;E&gt; UnsafeUnpin for <a class="struct" href="serde/de/value/struct.I64Deserializer.html" title="struct serde::de::value::I64Deserializer">I64Deserializer</a>&lt;E&gt;',
          1,
          ['serde::de::value::I64Deserializer'],
        ],
        [
          'impl&lt;E&gt; UnsafeUnpin for <a class="struct" href="serde/de/value/struct.I8Deserializer.html" title="struct serde::de::value::I8Deserializer">I8Deserializer</a>&lt;E&gt;',
          1,
          ['serde::de::value::I8Deserializer'],
        ],
        [
          'impl&lt;E&gt; UnsafeUnpin for <a class="struct" href="serde/de/value/struct.IsizeDeserializer.html" title="struct serde::de::value::IsizeDeserializer">IsizeDeserializer</a>&lt;E&gt;',
          1,
          ['serde::de::value::IsizeDeserializer'],
        ],
        [
          'impl&lt;E&gt; UnsafeUnpin for <a class="struct" href="serde/de/value/struct.StringDeserializer.html" title="struct serde::de::value::StringDeserializer">StringDeserializer</a>&lt;E&gt;',
          1,
          ['serde::de::value::StringDeserializer'],
        ],
        [
          'impl&lt;E&gt; UnsafeUnpin for <a class="struct" href="serde/de/value/struct.U128Deserializer.html" title="struct serde::de::value::U128Deserializer">U128Deserializer</a>&lt;E&gt;',
          1,
          ['serde::de::value::U128Deserializer'],
        ],
        [
          'impl&lt;E&gt; UnsafeUnpin for <a class="struct" href="serde/de/value/struct.U16Deserializer.html" title="struct serde::de::value::U16Deserializer">U16Deserializer</a>&lt;E&gt;',
          1,
          ['serde::de::value::U16Deserializer'],
        ],
        [
          'impl&lt;E&gt; UnsafeUnpin for <a class="struct" href="serde/de/value/struct.U32Deserializer.html" title="struct serde::de::value::U32Deserializer">U32Deserializer</a>&lt;E&gt;',
          1,
          ['serde::de::value::U32Deserializer'],
        ],
        [
          'impl&lt;E&gt; UnsafeUnpin for <a class="struct" href="serde/de/value/struct.U64Deserializer.html" title="struct serde::de::value::U64Deserializer">U64Deserializer</a>&lt;E&gt;',
          1,
          ['serde::de::value::U64Deserializer'],
        ],
        [
          'impl&lt;E&gt; UnsafeUnpin for <a class="struct" href="serde/de/value/struct.U8Deserializer.html" title="struct serde::de::value::U8Deserializer">U8Deserializer</a>&lt;E&gt;',
          1,
          ['serde::de::value::U8Deserializer'],
        ],
        [
          'impl&lt;E&gt; UnsafeUnpin for <a class="struct" href="serde/de/value/struct.UnitDeserializer.html" title="struct serde::de::value::UnitDeserializer">UnitDeserializer</a>&lt;E&gt;',
          1,
          ['serde::de::value::UnitDeserializer'],
        ],
        [
          'impl&lt;E&gt; UnsafeUnpin for <a class="struct" href="serde/de/value/struct.UsizeDeserializer.html" title="struct serde::de::value::UsizeDeserializer">UsizeDeserializer</a>&lt;E&gt;',
          1,
          ['serde::de::value::UsizeDeserializer'],
        ],
        [
          'impl&lt;I, E&gt; UnsafeUnpin for <a class="struct" href="serde/de/value/struct.SeqDeserializer.html" title="struct serde::de::value::SeqDeserializer">SeqDeserializer</a>&lt;I, E&gt;<div class="where">where\n    I: UnsafeUnpin,</div>',
          1,
          ['serde::de::value::SeqDeserializer'],
        ],
        [
          'impl&lt;Ok, Error&gt; UnsafeUnpin for <a class="struct" href="serde/ser/struct.Impossible.html" title="struct serde::ser::Impossible">Impossible</a>&lt;Ok, Error&gt;',
          1,
          ['serde::ser::impossible::Impossible'],
        ],
      ],
    ],
    [
      'serde_json',
      [
        [
          'impl UnsafeUnpin for <a class="enum" href="serde_json/enum.Value.html" title="enum serde_json::Value">Value</a>',
          1,
          ['serde_json::value::Value'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="serde_json/error/enum.Category.html" title="enum serde_json::error::Category">Category</a>',
          1,
          ['serde_json::error::Category'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="serde_json/ser/enum.CharEscape.html" title="enum serde_json::ser::CharEscape">CharEscape</a>',
          1,
          ['serde_json::ser::CharEscape'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="serde_json/map/struct.IntoIter.html" title="struct serde_json::map::IntoIter">IntoIter</a>',
          1,
          ['serde_json::map::IntoIter'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="serde_json/map/struct.IntoValues.html" title="struct serde_json::map::IntoValues">IntoValues</a>',
          1,
          ['serde_json::map::IntoValues'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="serde_json/ser/struct.CompactFormatter.html" title="struct serde_json::ser::CompactFormatter">CompactFormatter</a>',
          1,
          ['serde_json::ser::CompactFormatter'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="serde_json/struct.Error.html" title="struct serde_json::Error">Error</a>',
          1,
          ['serde_json::error::Error'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="serde_json/struct.Number.html" title="struct serde_json::Number">Number</a>',
          1,
          ['serde_json::number::Number'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="serde_json/value/struct.Serializer.html" title="struct serde_json::value::Serializer">Serializer</a>',
          1,
          ['serde_json::value::ser::Serializer'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="enum" href="serde_json/map/enum.Entry.html" title="enum serde_json::map::Entry">Entry</a>&lt;\'a&gt;',
          1,
          ['serde_json::map::Entry'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="serde_json/de/struct.SliceRead.html" title="struct serde_json::de::SliceRead">SliceRead</a>&lt;\'a&gt;',
          1,
          ['serde_json::read::SliceRead'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="serde_json/de/struct.StrRead.html" title="struct serde_json::de::StrRead">StrRead</a>&lt;\'a&gt;',
          1,
          ['serde_json::read::StrRead'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="serde_json/map/struct.Iter.html" title="struct serde_json::map::Iter">Iter</a>&lt;\'a&gt;',
          1,
          ['serde_json::map::Iter'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="serde_json/map/struct.IterMut.html" title="struct serde_json::map::IterMut">IterMut</a>&lt;\'a&gt;',
          1,
          ['serde_json::map::IterMut'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="serde_json/map/struct.Keys.html" title="struct serde_json::map::Keys">Keys</a>&lt;\'a&gt;',
          1,
          ['serde_json::map::Keys'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="serde_json/map/struct.OccupiedEntry.html" title="struct serde_json::map::OccupiedEntry">OccupiedEntry</a>&lt;\'a&gt;',
          1,
          ['serde_json::map::OccupiedEntry'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="serde_json/map/struct.VacantEntry.html" title="struct serde_json::map::VacantEntry">VacantEntry</a>&lt;\'a&gt;',
          1,
          ['serde_json::map::VacantEntry'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="serde_json/map/struct.Values.html" title="struct serde_json::map::Values">Values</a>&lt;\'a&gt;',
          1,
          ['serde_json::map::Values'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="serde_json/map/struct.ValuesMut.html" title="struct serde_json::map::ValuesMut">ValuesMut</a>&lt;\'a&gt;',
          1,
          ['serde_json::map::ValuesMut'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="serde_json/ser/struct.PrettyFormatter.html" title="struct serde_json::ser::PrettyFormatter">PrettyFormatter</a>&lt;\'a&gt;',
          1,
          ['serde_json::ser::PrettyFormatter'],
        ],
        [
          'impl&lt;\'de, R, T&gt; UnsafeUnpin for <a class="struct" href="serde_json/struct.StreamDeserializer.html" title="struct serde_json::StreamDeserializer">StreamDeserializer</a>&lt;\'de, R, T&gt;<div class="where">where\n    R: UnsafeUnpin,</div>',
          1,
          ['serde_json::de::StreamDeserializer'],
        ],
        [
          'impl&lt;K, V&gt; UnsafeUnpin for <a class="struct" href="serde_json/struct.Map.html" title="struct serde_json::Map">Map</a>&lt;K, V&gt;',
          1,
          ['serde_json::map::Map'],
        ],
        [
          'impl&lt;R&gt; UnsafeUnpin for <a class="struct" href="serde_json/de/struct.IoRead.html" title="struct serde_json::de::IoRead">IoRead</a>&lt;R&gt;<div class="where">where\n    R: UnsafeUnpin,</div>',
          1,
          ['serde_json::read::IoRead'],
        ],
        [
          'impl&lt;R&gt; UnsafeUnpin for <a class="struct" href="serde_json/struct.Deserializer.html" title="struct serde_json::Deserializer">Deserializer</a>&lt;R&gt;<div class="where">where\n    R: UnsafeUnpin,</div>',
          1,
          ['serde_json::de::Deserializer'],
        ],
        [
          'impl&lt;W, F&gt; UnsafeUnpin for <a class="struct" href="serde_json/struct.Serializer.html" title="struct serde_json::Serializer">Serializer</a>&lt;W, F&gt;<div class="where">where\n    W: UnsafeUnpin,\n    F: UnsafeUnpin,</div>',
          1,
          ['serde_json::ser::Serializer'],
        ],
      ],
    ],
    [
      'syn',
      [
        [
          'impl UnsafeUnpin for <a class="enum" href="syn/enum.AttrStyle.html" title="enum syn::AttrStyle">AttrStyle</a>',
          1,
          ['syn::attr::AttrStyle'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="syn/enum.BinOp.html" title="enum syn::BinOp">BinOp</a>',
          1,
          ['syn::op::BinOp'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="syn/enum.CapturedParam.html" title="enum syn::CapturedParam">CapturedParam</a>',
          1,
          ['syn::generics::CapturedParam'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="syn/enum.Data.html" title="enum syn::Data">Data</a>',
          1,
          ['syn::derive::Data'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="syn/enum.Expr.html" title="enum syn::Expr">Expr</a>',
          1,
          ['syn::expr::Expr'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="syn/enum.FieldMutability.html" title="enum syn::FieldMutability">FieldMutability</a>',
          1,
          ['syn::restriction::FieldMutability'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="syn/enum.Fields.html" title="enum syn::Fields">Fields</a>',
          1,
          ['syn::data::Fields'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="syn/enum.FnArg.html" title="enum syn::FnArg">FnArg</a>',
          1,
          ['syn::item::FnArg'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="syn/enum.ForeignItem.html" title="enum syn::ForeignItem">ForeignItem</a>',
          1,
          ['syn::item::ForeignItem'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="syn/enum.GenericArgument.html" title="enum syn::GenericArgument">GenericArgument</a>',
          1,
          ['syn::path::GenericArgument'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="syn/enum.GenericParam.html" title="enum syn::GenericParam">GenericParam</a>',
          1,
          ['syn::generics::GenericParam'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="syn/enum.ImplItem.html" title="enum syn::ImplItem">ImplItem</a>',
          1,
          ['syn::item::ImplItem'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="syn/enum.ImplRestriction.html" title="enum syn::ImplRestriction">ImplRestriction</a>',
          1,
          ['syn::item::ImplRestriction'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="syn/enum.Item.html" title="enum syn::Item">Item</a>',
          1,
          ['syn::item::Item'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="syn/enum.Lit.html" title="enum syn::Lit">Lit</a>',
          1,
          ['syn::lit::Lit'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="syn/enum.MacroDelimiter.html" title="enum syn::MacroDelimiter">MacroDelimiter</a>',
          1,
          ['syn::mac::MacroDelimiter'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="syn/enum.Member.html" title="enum syn::Member">Member</a>',
          1,
          ['syn::expr::Member'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="syn/enum.Meta.html" title="enum syn::Meta">Meta</a>',
          1,
          ['syn::attr::Meta'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="syn/enum.Pat.html" title="enum syn::Pat">Pat</a>',
          1,
          ['syn::pat::Pat'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="syn/enum.PathArguments.html" title="enum syn::PathArguments">PathArguments</a>',
          1,
          ['syn::path::PathArguments'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="syn/enum.PointerMutability.html" title="enum syn::PointerMutability">PointerMutability</a>',
          1,
          ['syn::expr::PointerMutability'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="syn/enum.RangeLimits.html" title="enum syn::RangeLimits">RangeLimits</a>',
          1,
          ['syn::expr::RangeLimits'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="syn/enum.ReturnType.html" title="enum syn::ReturnType">ReturnType</a>',
          1,
          ['syn::ty::ReturnType'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="syn/enum.StaticMutability.html" title="enum syn::StaticMutability">StaticMutability</a>',
          1,
          ['syn::item::StaticMutability'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="syn/enum.Stmt.html" title="enum syn::Stmt">Stmt</a>',
          1,
          ['syn::stmt::Stmt'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="syn/enum.TraitBoundModifier.html" title="enum syn::TraitBoundModifier">TraitBoundModifier</a>',
          1,
          ['syn::generics::TraitBoundModifier'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="syn/enum.TraitItem.html" title="enum syn::TraitItem">TraitItem</a>',
          1,
          ['syn::item::TraitItem'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="syn/enum.Type.html" title="enum syn::Type">Type</a>',
          1,
          ['syn::ty::Type'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="syn/enum.TypeParamBound.html" title="enum syn::TypeParamBound">TypeParamBound</a>',
          1,
          ['syn::generics::TypeParamBound'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="syn/enum.UnOp.html" title="enum syn::UnOp">UnOp</a>',
          1,
          ['syn::op::UnOp'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="syn/enum.UseTree.html" title="enum syn::UseTree">UseTree</a>',
          1,
          ['syn::item::UseTree'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="syn/enum.Visibility.html" title="enum syn::Visibility">Visibility</a>',
          1,
          ['syn::restriction::Visibility'],
        ],
        [
          'impl UnsafeUnpin for <a class="enum" href="syn/enum.WherePredicate.html" title="enum syn::WherePredicate">WherePredicate</a>',
          1,
          ['syn::generics::WherePredicate'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/buffer/struct.TokenBuffer.html" title="struct syn::buffer::TokenBuffer">TokenBuffer</a>',
          1,
          ['syn::buffer::TokenBuffer'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/parse/struct.End.html" title="struct syn::parse::End">End</a>',
          1,
          ['syn::lookahead::End'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/parse/struct.Nothing.html" title="struct syn::parse::Nothing">Nothing</a>',
          1,
          ['syn::parse::Nothing'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.Abi.html" title="struct syn::Abi">Abi</a>',
          1,
          ['syn::ty::Abi'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.AngleBracketedGenericArguments.html" title="struct syn::AngleBracketedGenericArguments">AngleBracketedGenericArguments</a>',
          1,
          ['syn::path::AngleBracketedGenericArguments'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.Arm.html" title="struct syn::Arm">Arm</a>',
          1,
          ['syn::expr::Arm'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.AssocConst.html" title="struct syn::AssocConst">AssocConst</a>',
          1,
          ['syn::path::AssocConst'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.AssocType.html" title="struct syn::AssocType">AssocType</a>',
          1,
          ['syn::path::AssocType'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.Attribute.html" title="struct syn::Attribute">Attribute</a>',
          1,
          ['syn::attr::Attribute'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.BareFnArg.html" title="struct syn::BareFnArg">BareFnArg</a>',
          1,
          ['syn::ty::BareFnArg'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.BareVariadic.html" title="struct syn::BareVariadic">BareVariadic</a>',
          1,
          ['syn::ty::BareVariadic'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.Block.html" title="struct syn::Block">Block</a>',
          1,
          ['syn::stmt::Block'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.BoundLifetimes.html" title="struct syn::BoundLifetimes">BoundLifetimes</a>',
          1,
          ['syn::generics::BoundLifetimes'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ConstParam.html" title="struct syn::ConstParam">ConstParam</a>',
          1,
          ['syn::generics::ConstParam'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.Constraint.html" title="struct syn::Constraint">Constraint</a>',
          1,
          ['syn::path::Constraint'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.DataEnum.html" title="struct syn::DataEnum">DataEnum</a>',
          1,
          ['syn::derive::DataEnum'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.DataStruct.html" title="struct syn::DataStruct">DataStruct</a>',
          1,
          ['syn::derive::DataStruct'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.DataUnion.html" title="struct syn::DataUnion">DataUnion</a>',
          1,
          ['syn::derive::DataUnion'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.DeriveInput.html" title="struct syn::DeriveInput">DeriveInput</a>',
          1,
          ['syn::derive::DeriveInput'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.Error.html" title="struct syn::Error">Error</a>',
          1,
          ['syn::error::Error'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprArray.html" title="struct syn::ExprArray">ExprArray</a>',
          1,
          ['syn::expr::ExprArray'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprAssign.html" title="struct syn::ExprAssign">ExprAssign</a>',
          1,
          ['syn::expr::ExprAssign'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprAsync.html" title="struct syn::ExprAsync">ExprAsync</a>',
          1,
          ['syn::expr::ExprAsync'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprAwait.html" title="struct syn::ExprAwait">ExprAwait</a>',
          1,
          ['syn::expr::ExprAwait'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprBinary.html" title="struct syn::ExprBinary">ExprBinary</a>',
          1,
          ['syn::expr::ExprBinary'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprBlock.html" title="struct syn::ExprBlock">ExprBlock</a>',
          1,
          ['syn::expr::ExprBlock'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprBreak.html" title="struct syn::ExprBreak">ExprBreak</a>',
          1,
          ['syn::expr::ExprBreak'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprCall.html" title="struct syn::ExprCall">ExprCall</a>',
          1,
          ['syn::expr::ExprCall'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprCast.html" title="struct syn::ExprCast">ExprCast</a>',
          1,
          ['syn::expr::ExprCast'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprClosure.html" title="struct syn::ExprClosure">ExprClosure</a>',
          1,
          ['syn::expr::ExprClosure'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprConst.html" title="struct syn::ExprConst">ExprConst</a>',
          1,
          ['syn::expr::ExprConst'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprContinue.html" title="struct syn::ExprContinue">ExprContinue</a>',
          1,
          ['syn::expr::ExprContinue'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprField.html" title="struct syn::ExprField">ExprField</a>',
          1,
          ['syn::expr::ExprField'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprForLoop.html" title="struct syn::ExprForLoop">ExprForLoop</a>',
          1,
          ['syn::expr::ExprForLoop'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprGroup.html" title="struct syn::ExprGroup">ExprGroup</a>',
          1,
          ['syn::expr::ExprGroup'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprIf.html" title="struct syn::ExprIf">ExprIf</a>',
          1,
          ['syn::expr::ExprIf'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprIndex.html" title="struct syn::ExprIndex">ExprIndex</a>',
          1,
          ['syn::expr::ExprIndex'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprInfer.html" title="struct syn::ExprInfer">ExprInfer</a>',
          1,
          ['syn::expr::ExprInfer'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprLet.html" title="struct syn::ExprLet">ExprLet</a>',
          1,
          ['syn::expr::ExprLet'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprLit.html" title="struct syn::ExprLit">ExprLit</a>',
          1,
          ['syn::expr::ExprLit'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprLoop.html" title="struct syn::ExprLoop">ExprLoop</a>',
          1,
          ['syn::expr::ExprLoop'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprMacro.html" title="struct syn::ExprMacro">ExprMacro</a>',
          1,
          ['syn::expr::ExprMacro'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprMatch.html" title="struct syn::ExprMatch">ExprMatch</a>',
          1,
          ['syn::expr::ExprMatch'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprMethodCall.html" title="struct syn::ExprMethodCall">ExprMethodCall</a>',
          1,
          ['syn::expr::ExprMethodCall'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprParen.html" title="struct syn::ExprParen">ExprParen</a>',
          1,
          ['syn::expr::ExprParen'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprPath.html" title="struct syn::ExprPath">ExprPath</a>',
          1,
          ['syn::expr::ExprPath'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprRange.html" title="struct syn::ExprRange">ExprRange</a>',
          1,
          ['syn::expr::ExprRange'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprRawAddr.html" title="struct syn::ExprRawAddr">ExprRawAddr</a>',
          1,
          ['syn::expr::ExprRawAddr'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprReference.html" title="struct syn::ExprReference">ExprReference</a>',
          1,
          ['syn::expr::ExprReference'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprRepeat.html" title="struct syn::ExprRepeat">ExprRepeat</a>',
          1,
          ['syn::expr::ExprRepeat'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprReturn.html" title="struct syn::ExprReturn">ExprReturn</a>',
          1,
          ['syn::expr::ExprReturn'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprStruct.html" title="struct syn::ExprStruct">ExprStruct</a>',
          1,
          ['syn::expr::ExprStruct'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprTry.html" title="struct syn::ExprTry">ExprTry</a>',
          1,
          ['syn::expr::ExprTry'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprTryBlock.html" title="struct syn::ExprTryBlock">ExprTryBlock</a>',
          1,
          ['syn::expr::ExprTryBlock'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprTuple.html" title="struct syn::ExprTuple">ExprTuple</a>',
          1,
          ['syn::expr::ExprTuple'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprUnary.html" title="struct syn::ExprUnary">ExprUnary</a>',
          1,
          ['syn::expr::ExprUnary'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprUnsafe.html" title="struct syn::ExprUnsafe">ExprUnsafe</a>',
          1,
          ['syn::expr::ExprUnsafe'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprWhile.html" title="struct syn::ExprWhile">ExprWhile</a>',
          1,
          ['syn::expr::ExprWhile'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ExprYield.html" title="struct syn::ExprYield">ExprYield</a>',
          1,
          ['syn::expr::ExprYield'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.Field.html" title="struct syn::Field">Field</a>',
          1,
          ['syn::data::Field'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.FieldPat.html" title="struct syn::FieldPat">FieldPat</a>',
          1,
          ['syn::pat::FieldPat'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.FieldValue.html" title="struct syn::FieldValue">FieldValue</a>',
          1,
          ['syn::expr::FieldValue'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.FieldsNamed.html" title="struct syn::FieldsNamed">FieldsNamed</a>',
          1,
          ['syn::data::FieldsNamed'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.FieldsUnnamed.html" title="struct syn::FieldsUnnamed">FieldsUnnamed</a>',
          1,
          ['syn::data::FieldsUnnamed'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.File.html" title="struct syn::File">File</a>',
          1,
          ['syn::file::File'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ForeignItemFn.html" title="struct syn::ForeignItemFn">ForeignItemFn</a>',
          1,
          ['syn::item::ForeignItemFn'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ForeignItemMacro.html" title="struct syn::ForeignItemMacro">ForeignItemMacro</a>',
          1,
          ['syn::item::ForeignItemMacro'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ForeignItemStatic.html" title="struct syn::ForeignItemStatic">ForeignItemStatic</a>',
          1,
          ['syn::item::ForeignItemStatic'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ForeignItemType.html" title="struct syn::ForeignItemType">ForeignItemType</a>',
          1,
          ['syn::item::ForeignItemType'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.Generics.html" title="struct syn::Generics">Generics</a>',
          1,
          ['syn::generics::Generics'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ImplItemConst.html" title="struct syn::ImplItemConst">ImplItemConst</a>',
          1,
          ['syn::item::ImplItemConst'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ImplItemFn.html" title="struct syn::ImplItemFn">ImplItemFn</a>',
          1,
          ['syn::item::ImplItemFn'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ImplItemMacro.html" title="struct syn::ImplItemMacro">ImplItemMacro</a>',
          1,
          ['syn::item::ImplItemMacro'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ImplItemType.html" title="struct syn::ImplItemType">ImplItemType</a>',
          1,
          ['syn::item::ImplItemType'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.Index.html" title="struct syn::Index">Index</a>',
          1,
          ['syn::expr::Index'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ItemConst.html" title="struct syn::ItemConst">ItemConst</a>',
          1,
          ['syn::item::ItemConst'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ItemEnum.html" title="struct syn::ItemEnum">ItemEnum</a>',
          1,
          ['syn::item::ItemEnum'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ItemExternCrate.html" title="struct syn::ItemExternCrate">ItemExternCrate</a>',
          1,
          ['syn::item::ItemExternCrate'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ItemFn.html" title="struct syn::ItemFn">ItemFn</a>',
          1,
          ['syn::item::ItemFn'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ItemForeignMod.html" title="struct syn::ItemForeignMod">ItemForeignMod</a>',
          1,
          ['syn::item::ItemForeignMod'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ItemImpl.html" title="struct syn::ItemImpl">ItemImpl</a>',
          1,
          ['syn::item::ItemImpl'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ItemMacro.html" title="struct syn::ItemMacro">ItemMacro</a>',
          1,
          ['syn::item::ItemMacro'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ItemMod.html" title="struct syn::ItemMod">ItemMod</a>',
          1,
          ['syn::item::ItemMod'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ItemStatic.html" title="struct syn::ItemStatic">ItemStatic</a>',
          1,
          ['syn::item::ItemStatic'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ItemStruct.html" title="struct syn::ItemStruct">ItemStruct</a>',
          1,
          ['syn::item::ItemStruct'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ItemTrait.html" title="struct syn::ItemTrait">ItemTrait</a>',
          1,
          ['syn::item::ItemTrait'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ItemTraitAlias.html" title="struct syn::ItemTraitAlias">ItemTraitAlias</a>',
          1,
          ['syn::item::ItemTraitAlias'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ItemType.html" title="struct syn::ItemType">ItemType</a>',
          1,
          ['syn::item::ItemType'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ItemUnion.html" title="struct syn::ItemUnion">ItemUnion</a>',
          1,
          ['syn::item::ItemUnion'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ItemUse.html" title="struct syn::ItemUse">ItemUse</a>',
          1,
          ['syn::item::ItemUse'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.Label.html" title="struct syn::Label">Label</a>',
          1,
          ['syn::expr::Label'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.Lifetime.html" title="struct syn::Lifetime">Lifetime</a>',
          1,
          ['syn::lifetime::Lifetime'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.LifetimeParam.html" title="struct syn::LifetimeParam">LifetimeParam</a>',
          1,
          ['syn::generics::LifetimeParam'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.LitBool.html" title="struct syn::LitBool">LitBool</a>',
          1,
          ['syn::lit::LitBool'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.LitByte.html" title="struct syn::LitByte">LitByte</a>',
          1,
          ['syn::lit::LitByte'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.LitByteStr.html" title="struct syn::LitByteStr">LitByteStr</a>',
          1,
          ['syn::lit::LitByteStr'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.LitCStr.html" title="struct syn::LitCStr">LitCStr</a>',
          1,
          ['syn::lit::LitCStr'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.LitChar.html" title="struct syn::LitChar">LitChar</a>',
          1,
          ['syn::lit::LitChar'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.LitFloat.html" title="struct syn::LitFloat">LitFloat</a>',
          1,
          ['syn::lit::LitFloat'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.LitInt.html" title="struct syn::LitInt">LitInt</a>',
          1,
          ['syn::lit::LitInt'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.LitStr.html" title="struct syn::LitStr">LitStr</a>',
          1,
          ['syn::lit::LitStr'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.Local.html" title="struct syn::Local">Local</a>',
          1,
          ['syn::stmt::Local'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.LocalInit.html" title="struct syn::LocalInit">LocalInit</a>',
          1,
          ['syn::stmt::LocalInit'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.Macro.html" title="struct syn::Macro">Macro</a>',
          1,
          ['syn::mac::Macro'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.MetaList.html" title="struct syn::MetaList">MetaList</a>',
          1,
          ['syn::attr::MetaList'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.MetaNameValue.html" title="struct syn::MetaNameValue">MetaNameValue</a>',
          1,
          ['syn::attr::MetaNameValue'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.ParenthesizedGenericArguments.html" title="struct syn::ParenthesizedGenericArguments">ParenthesizedGenericArguments</a>',
          1,
          ['syn::path::ParenthesizedGenericArguments'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.PatIdent.html" title="struct syn::PatIdent">PatIdent</a>',
          1,
          ['syn::pat::PatIdent'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.PatOr.html" title="struct syn::PatOr">PatOr</a>',
          1,
          ['syn::pat::PatOr'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.PatParen.html" title="struct syn::PatParen">PatParen</a>',
          1,
          ['syn::pat::PatParen'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.PatReference.html" title="struct syn::PatReference">PatReference</a>',
          1,
          ['syn::pat::PatReference'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.PatRest.html" title="struct syn::PatRest">PatRest</a>',
          1,
          ['syn::pat::PatRest'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.PatSlice.html" title="struct syn::PatSlice">PatSlice</a>',
          1,
          ['syn::pat::PatSlice'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.PatStruct.html" title="struct syn::PatStruct">PatStruct</a>',
          1,
          ['syn::pat::PatStruct'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.PatTuple.html" title="struct syn::PatTuple">PatTuple</a>',
          1,
          ['syn::pat::PatTuple'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.PatTupleStruct.html" title="struct syn::PatTupleStruct">PatTupleStruct</a>',
          1,
          ['syn::pat::PatTupleStruct'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.PatType.html" title="struct syn::PatType">PatType</a>',
          1,
          ['syn::pat::PatType'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.PatWild.html" title="struct syn::PatWild">PatWild</a>',
          1,
          ['syn::pat::PatWild'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.Path.html" title="struct syn::Path">Path</a>',
          1,
          ['syn::path::Path'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.PathSegment.html" title="struct syn::PathSegment">PathSegment</a>',
          1,
          ['syn::path::PathSegment'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.PreciseCapture.html" title="struct syn::PreciseCapture">PreciseCapture</a>',
          1,
          ['syn::generics::PreciseCapture'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.PredicateLifetime.html" title="struct syn::PredicateLifetime">PredicateLifetime</a>',
          1,
          ['syn::generics::PredicateLifetime'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.PredicateType.html" title="struct syn::PredicateType">PredicateType</a>',
          1,
          ['syn::generics::PredicateType'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.QSelf.html" title="struct syn::QSelf">QSelf</a>',
          1,
          ['syn::path::QSelf'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.Receiver.html" title="struct syn::Receiver">Receiver</a>',
          1,
          ['syn::item::Receiver'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.Signature.html" title="struct syn::Signature">Signature</a>',
          1,
          ['syn::item::Signature'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.StmtMacro.html" title="struct syn::StmtMacro">StmtMacro</a>',
          1,
          ['syn::stmt::StmtMacro'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.TraitBound.html" title="struct syn::TraitBound">TraitBound</a>',
          1,
          ['syn::generics::TraitBound'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.TraitItemConst.html" title="struct syn::TraitItemConst">TraitItemConst</a>',
          1,
          ['syn::item::TraitItemConst'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.TraitItemFn.html" title="struct syn::TraitItemFn">TraitItemFn</a>',
          1,
          ['syn::item::TraitItemFn'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.TraitItemMacro.html" title="struct syn::TraitItemMacro">TraitItemMacro</a>',
          1,
          ['syn::item::TraitItemMacro'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.TraitItemType.html" title="struct syn::TraitItemType">TraitItemType</a>',
          1,
          ['syn::item::TraitItemType'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.TypeArray.html" title="struct syn::TypeArray">TypeArray</a>',
          1,
          ['syn::ty::TypeArray'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.TypeBareFn.html" title="struct syn::TypeBareFn">TypeBareFn</a>',
          1,
          ['syn::ty::TypeBareFn'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.TypeGroup.html" title="struct syn::TypeGroup">TypeGroup</a>',
          1,
          ['syn::ty::TypeGroup'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.TypeImplTrait.html" title="struct syn::TypeImplTrait">TypeImplTrait</a>',
          1,
          ['syn::ty::TypeImplTrait'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.TypeInfer.html" title="struct syn::TypeInfer">TypeInfer</a>',
          1,
          ['syn::ty::TypeInfer'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.TypeMacro.html" title="struct syn::TypeMacro">TypeMacro</a>',
          1,
          ['syn::ty::TypeMacro'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.TypeNever.html" title="struct syn::TypeNever">TypeNever</a>',
          1,
          ['syn::ty::TypeNever'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.TypeParam.html" title="struct syn::TypeParam">TypeParam</a>',
          1,
          ['syn::generics::TypeParam'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.TypeParen.html" title="struct syn::TypeParen">TypeParen</a>',
          1,
          ['syn::ty::TypeParen'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.TypePath.html" title="struct syn::TypePath">TypePath</a>',
          1,
          ['syn::ty::TypePath'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.TypePtr.html" title="struct syn::TypePtr">TypePtr</a>',
          1,
          ['syn::ty::TypePtr'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.TypeReference.html" title="struct syn::TypeReference">TypeReference</a>',
          1,
          ['syn::ty::TypeReference'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.TypeSlice.html" title="struct syn::TypeSlice">TypeSlice</a>',
          1,
          ['syn::ty::TypeSlice'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.TypeTraitObject.html" title="struct syn::TypeTraitObject">TypeTraitObject</a>',
          1,
          ['syn::ty::TypeTraitObject'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.TypeTuple.html" title="struct syn::TypeTuple">TypeTuple</a>',
          1,
          ['syn::ty::TypeTuple'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.UseGlob.html" title="struct syn::UseGlob">UseGlob</a>',
          1,
          ['syn::item::UseGlob'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.UseGroup.html" title="struct syn::UseGroup">UseGroup</a>',
          1,
          ['syn::item::UseGroup'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.UseName.html" title="struct syn::UseName">UseName</a>',
          1,
          ['syn::item::UseName'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.UsePath.html" title="struct syn::UsePath">UsePath</a>',
          1,
          ['syn::item::UsePath'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.UseRename.html" title="struct syn::UseRename">UseRename</a>',
          1,
          ['syn::item::UseRename'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.Variadic.html" title="struct syn::Variadic">Variadic</a>',
          1,
          ['syn::item::Variadic'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.Variant.html" title="struct syn::Variant">Variant</a>',
          1,
          ['syn::data::Variant'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.VisRestricted.html" title="struct syn::VisRestricted">VisRestricted</a>',
          1,
          ['syn::restriction::VisRestricted'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/struct.WhereClause.html" title="struct syn::WhereClause">WhereClause</a>',
          1,
          ['syn::generics::WhereClause'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Abstract.html" title="struct syn::token::Abstract">Abstract</a>',
          1,
          ['syn::token::Abstract'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.And.html" title="struct syn::token::And">And</a>',
          1,
          ['syn::token::And'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.AndAnd.html" title="struct syn::token::AndAnd">AndAnd</a>',
          1,
          ['syn::token::AndAnd'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.AndEq.html" title="struct syn::token::AndEq">AndEq</a>',
          1,
          ['syn::token::AndEq'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.As.html" title="struct syn::token::As">As</a>',
          1,
          ['syn::token::As'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Async.html" title="struct syn::token::Async">Async</a>',
          1,
          ['syn::token::Async'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.At.html" title="struct syn::token::At">At</a>',
          1,
          ['syn::token::At'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Auto.html" title="struct syn::token::Auto">Auto</a>',
          1,
          ['syn::token::Auto'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Await.html" title="struct syn::token::Await">Await</a>',
          1,
          ['syn::token::Await'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Become.html" title="struct syn::token::Become">Become</a>',
          1,
          ['syn::token::Become'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Box.html" title="struct syn::token::Box">Box</a>',
          1,
          ['syn::token::Box'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Brace.html" title="struct syn::token::Brace">Brace</a>',
          1,
          ['syn::token::Brace'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Bracket.html" title="struct syn::token::Bracket">Bracket</a>',
          1,
          ['syn::token::Bracket'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Break.html" title="struct syn::token::Break">Break</a>',
          1,
          ['syn::token::Break'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Caret.html" title="struct syn::token::Caret">Caret</a>',
          1,
          ['syn::token::Caret'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.CaretEq.html" title="struct syn::token::CaretEq">CaretEq</a>',
          1,
          ['syn::token::CaretEq'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Colon.html" title="struct syn::token::Colon">Colon</a>',
          1,
          ['syn::token::Colon'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Comma.html" title="struct syn::token::Comma">Comma</a>',
          1,
          ['syn::token::Comma'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Const.html" title="struct syn::token::Const">Const</a>',
          1,
          ['syn::token::Const'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Continue.html" title="struct syn::token::Continue">Continue</a>',
          1,
          ['syn::token::Continue'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Crate.html" title="struct syn::token::Crate">Crate</a>',
          1,
          ['syn::token::Crate'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Default.html" title="struct syn::token::Default">Default</a>',
          1,
          ['syn::token::Default'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Do.html" title="struct syn::token::Do">Do</a>',
          1,
          ['syn::token::Do'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Dollar.html" title="struct syn::token::Dollar">Dollar</a>',
          1,
          ['syn::token::Dollar'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Dot.html" title="struct syn::token::Dot">Dot</a>',
          1,
          ['syn::token::Dot'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.DotDot.html" title="struct syn::token::DotDot">DotDot</a>',
          1,
          ['syn::token::DotDot'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.DotDotDot.html" title="struct syn::token::DotDotDot">DotDotDot</a>',
          1,
          ['syn::token::DotDotDot'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.DotDotEq.html" title="struct syn::token::DotDotEq">DotDotEq</a>',
          1,
          ['syn::token::DotDotEq'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Dyn.html" title="struct syn::token::Dyn">Dyn</a>',
          1,
          ['syn::token::Dyn'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Else.html" title="struct syn::token::Else">Else</a>',
          1,
          ['syn::token::Else'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Enum.html" title="struct syn::token::Enum">Enum</a>',
          1,
          ['syn::token::Enum'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Eq.html" title="struct syn::token::Eq">Eq</a>',
          1,
          ['syn::token::Eq'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.EqEq.html" title="struct syn::token::EqEq">EqEq</a>',
          1,
          ['syn::token::EqEq'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Extern.html" title="struct syn::token::Extern">Extern</a>',
          1,
          ['syn::token::Extern'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.FatArrow.html" title="struct syn::token::FatArrow">FatArrow</a>',
          1,
          ['syn::token::FatArrow'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Final.html" title="struct syn::token::Final">Final</a>',
          1,
          ['syn::token::Final'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Fn.html" title="struct syn::token::Fn">Fn</a>',
          1,
          ['syn::token::Fn'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.For.html" title="struct syn::token::For">For</a>',
          1,
          ['syn::token::For'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Ge.html" title="struct syn::token::Ge">Ge</a>',
          1,
          ['syn::token::Ge'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Group.html" title="struct syn::token::Group">Group</a>',
          1,
          ['syn::token::Group'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Gt.html" title="struct syn::token::Gt">Gt</a>',
          1,
          ['syn::token::Gt'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.If.html" title="struct syn::token::If">If</a>',
          1,
          ['syn::token::If'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Impl.html" title="struct syn::token::Impl">Impl</a>',
          1,
          ['syn::token::Impl'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.In.html" title="struct syn::token::In">In</a>',
          1,
          ['syn::token::In'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.LArrow.html" title="struct syn::token::LArrow">LArrow</a>',
          1,
          ['syn::token::LArrow'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Le.html" title="struct syn::token::Le">Le</a>',
          1,
          ['syn::token::Le'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Let.html" title="struct syn::token::Let">Let</a>',
          1,
          ['syn::token::Let'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Loop.html" title="struct syn::token::Loop">Loop</a>',
          1,
          ['syn::token::Loop'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Lt.html" title="struct syn::token::Lt">Lt</a>',
          1,
          ['syn::token::Lt'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Macro.html" title="struct syn::token::Macro">Macro</a>',
          1,
          ['syn::token::Macro'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Match.html" title="struct syn::token::Match">Match</a>',
          1,
          ['syn::token::Match'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Minus.html" title="struct syn::token::Minus">Minus</a>',
          1,
          ['syn::token::Minus'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.MinusEq.html" title="struct syn::token::MinusEq">MinusEq</a>',
          1,
          ['syn::token::MinusEq'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Mod.html" title="struct syn::token::Mod">Mod</a>',
          1,
          ['syn::token::Mod'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Move.html" title="struct syn::token::Move">Move</a>',
          1,
          ['syn::token::Move'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Mut.html" title="struct syn::token::Mut">Mut</a>',
          1,
          ['syn::token::Mut'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Ne.html" title="struct syn::token::Ne">Ne</a>',
          1,
          ['syn::token::Ne'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Not.html" title="struct syn::token::Not">Not</a>',
          1,
          ['syn::token::Not'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Or.html" title="struct syn::token::Or">Or</a>',
          1,
          ['syn::token::Or'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.OrEq.html" title="struct syn::token::OrEq">OrEq</a>',
          1,
          ['syn::token::OrEq'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.OrOr.html" title="struct syn::token::OrOr">OrOr</a>',
          1,
          ['syn::token::OrOr'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Override.html" title="struct syn::token::Override">Override</a>',
          1,
          ['syn::token::Override'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Paren.html" title="struct syn::token::Paren">Paren</a>',
          1,
          ['syn::token::Paren'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.PathSep.html" title="struct syn::token::PathSep">PathSep</a>',
          1,
          ['syn::token::PathSep'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Percent.html" title="struct syn::token::Percent">Percent</a>',
          1,
          ['syn::token::Percent'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.PercentEq.html" title="struct syn::token::PercentEq">PercentEq</a>',
          1,
          ['syn::token::PercentEq'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Plus.html" title="struct syn::token::Plus">Plus</a>',
          1,
          ['syn::token::Plus'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.PlusEq.html" title="struct syn::token::PlusEq">PlusEq</a>',
          1,
          ['syn::token::PlusEq'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Pound.html" title="struct syn::token::Pound">Pound</a>',
          1,
          ['syn::token::Pound'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Priv.html" title="struct syn::token::Priv">Priv</a>',
          1,
          ['syn::token::Priv'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Pub.html" title="struct syn::token::Pub">Pub</a>',
          1,
          ['syn::token::Pub'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Question.html" title="struct syn::token::Question">Question</a>',
          1,
          ['syn::token::Question'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.RArrow.html" title="struct syn::token::RArrow">RArrow</a>',
          1,
          ['syn::token::RArrow'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Raw.html" title="struct syn::token::Raw">Raw</a>',
          1,
          ['syn::token::Raw'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Ref.html" title="struct syn::token::Ref">Ref</a>',
          1,
          ['syn::token::Ref'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Return.html" title="struct syn::token::Return">Return</a>',
          1,
          ['syn::token::Return'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.SelfType.html" title="struct syn::token::SelfType">SelfType</a>',
          1,
          ['syn::token::SelfType'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.SelfValue.html" title="struct syn::token::SelfValue">SelfValue</a>',
          1,
          ['syn::token::SelfValue'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Semi.html" title="struct syn::token::Semi">Semi</a>',
          1,
          ['syn::token::Semi'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Shl.html" title="struct syn::token::Shl">Shl</a>',
          1,
          ['syn::token::Shl'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.ShlEq.html" title="struct syn::token::ShlEq">ShlEq</a>',
          1,
          ['syn::token::ShlEq'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Shr.html" title="struct syn::token::Shr">Shr</a>',
          1,
          ['syn::token::Shr'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.ShrEq.html" title="struct syn::token::ShrEq">ShrEq</a>',
          1,
          ['syn::token::ShrEq'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Slash.html" title="struct syn::token::Slash">Slash</a>',
          1,
          ['syn::token::Slash'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.SlashEq.html" title="struct syn::token::SlashEq">SlashEq</a>',
          1,
          ['syn::token::SlashEq'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Star.html" title="struct syn::token::Star">Star</a>',
          1,
          ['syn::token::Star'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.StarEq.html" title="struct syn::token::StarEq">StarEq</a>',
          1,
          ['syn::token::StarEq'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Static.html" title="struct syn::token::Static">Static</a>',
          1,
          ['syn::token::Static'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Struct.html" title="struct syn::token::Struct">Struct</a>',
          1,
          ['syn::token::Struct'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Super.html" title="struct syn::token::Super">Super</a>',
          1,
          ['syn::token::Super'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Tilde.html" title="struct syn::token::Tilde">Tilde</a>',
          1,
          ['syn::token::Tilde'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Trait.html" title="struct syn::token::Trait">Trait</a>',
          1,
          ['syn::token::Trait'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Try.html" title="struct syn::token::Try">Try</a>',
          1,
          ['syn::token::Try'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Type.html" title="struct syn::token::Type">Type</a>',
          1,
          ['syn::token::Type'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Typeof.html" title="struct syn::token::Typeof">Typeof</a>',
          1,
          ['syn::token::Typeof'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Underscore.html" title="struct syn::token::Underscore">Underscore</a>',
          1,
          ['syn::token::Underscore'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Union.html" title="struct syn::token::Union">Union</a>',
          1,
          ['syn::token::Union'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Unsafe.html" title="struct syn::token::Unsafe">Unsafe</a>',
          1,
          ['syn::token::Unsafe'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Unsized.html" title="struct syn::token::Unsized">Unsized</a>',
          1,
          ['syn::token::Unsized'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Use.html" title="struct syn::token::Use">Use</a>',
          1,
          ['syn::token::Use'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Virtual.html" title="struct syn::token::Virtual">Virtual</a>',
          1,
          ['syn::token::Virtual'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Where.html" title="struct syn::token::Where">Where</a>',
          1,
          ['syn::token::Where'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.While.html" title="struct syn::token::While">While</a>',
          1,
          ['syn::token::While'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="syn/token/struct.Yield.html" title="struct syn::token::Yield">Yield</a>',
          1,
          ['syn::token::Yield'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="syn/buffer/struct.Cursor.html" title="struct syn::buffer::Cursor">Cursor</a>&lt;\'a&gt;',
          1,
          ['syn::buffer::Cursor'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="syn/meta/struct.ParseNestedMeta.html" title="struct syn::meta::ParseNestedMeta">ParseNestedMeta</a>&lt;\'a&gt;',
          1,
          ['syn::meta::ParseNestedMeta'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="syn/parse/struct.Lookahead1.html" title="struct syn::parse::Lookahead1">Lookahead1</a>&lt;\'a&gt;',
          1,
          ['syn::lookahead::Lookahead1'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="syn/parse/struct.ParseBuffer.html" title="struct syn::parse::ParseBuffer">ParseBuffer</a>&lt;\'a&gt;',
          1,
          ['syn::parse::ParseBuffer'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="syn/struct.ImplGenerics.html" title="struct syn::ImplGenerics">ImplGenerics</a>&lt;\'a&gt;',
          1,
          ['syn::generics::ImplGenerics'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="syn/struct.Turbofish.html" title="struct syn::Turbofish">Turbofish</a>&lt;\'a&gt;',
          1,
          ['syn::generics::Turbofish'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="syn/struct.TypeGenerics.html" title="struct syn::TypeGenerics">TypeGenerics</a>&lt;\'a&gt;',
          1,
          ['syn::generics::TypeGenerics'],
        ],
        [
          'impl&lt;\'a, T&gt; UnsafeUnpin for <a class="struct" href="syn/punctuated/struct.Iter.html" title="struct syn::punctuated::Iter">Iter</a>&lt;\'a, T&gt;',
          1,
          ['syn::punctuated::Iter'],
        ],
        [
          'impl&lt;\'a, T&gt; UnsafeUnpin for <a class="struct" href="syn/punctuated/struct.IterMut.html" title="struct syn::punctuated::IterMut">IterMut</a>&lt;\'a, T&gt;',
          1,
          ['syn::punctuated::IterMut'],
        ],
        [
          'impl&lt;\'a, T, P&gt; UnsafeUnpin for <a class="struct" href="syn/punctuated/struct.Pairs.html" title="struct syn::punctuated::Pairs">Pairs</a>&lt;\'a, T, P&gt;',
          1,
          ['syn::punctuated::Pairs'],
        ],
        [
          'impl&lt;\'a, T, P&gt; UnsafeUnpin for <a class="struct" href="syn/punctuated/struct.PairsMut.html" title="struct syn::punctuated::PairsMut">PairsMut</a>&lt;\'a, T, P&gt;',
          1,
          ['syn::punctuated::PairsMut'],
        ],
        [
          'impl&lt;\'c, \'a&gt; UnsafeUnpin for <a class="struct" href="syn/parse/struct.StepCursor.html" title="struct syn::parse::StepCursor">StepCursor</a>&lt;\'c, \'a&gt;',
          1,
          ['syn::parse::StepCursor'],
        ],
        [
          'impl&lt;T&gt; UnsafeUnpin for <a class="struct" href="syn/punctuated/struct.IntoIter.html" title="struct syn::punctuated::IntoIter">IntoIter</a>&lt;T&gt;',
          1,
          ['syn::punctuated::IntoIter'],
        ],
        [
          'impl&lt;T, P&gt; UnsafeUnpin for <a class="enum" href="syn/punctuated/enum.Pair.html" title="enum syn::punctuated::Pair">Pair</a>&lt;T, P&gt;<div class="where">where\n    T: UnsafeUnpin,\n    P: UnsafeUnpin,</div>',
          1,
          ['syn::punctuated::Pair'],
        ],
        [
          'impl&lt;T, P&gt; UnsafeUnpin for <a class="struct" href="syn/punctuated/struct.IntoPairs.html" title="struct syn::punctuated::IntoPairs">IntoPairs</a>&lt;T, P&gt;<div class="where">where\n    T: UnsafeUnpin,</div>',
          1,
          ['syn::punctuated::IntoPairs'],
        ],
        [
          'impl&lt;T, P&gt; UnsafeUnpin for <a class="struct" href="syn/punctuated/struct.Punctuated.html" title="struct syn::punctuated::Punctuated">Punctuated</a>&lt;T, P&gt;',
          1,
          ['syn::punctuated::Punctuated'],
        ],
      ],
    ],
    [
      'unicode_segmentation',
      [
        [
          'impl UnsafeUnpin for <a class="enum" href="unicode_segmentation/enum.GraphemeIncomplete.html" title="enum unicode_segmentation::GraphemeIncomplete">GraphemeIncomplete</a>',
          1,
          ['unicode_segmentation::grapheme::GraphemeIncomplete'],
        ],
        [
          'impl UnsafeUnpin for <a class="struct" href="unicode_segmentation/struct.GraphemeCursor.html" title="struct unicode_segmentation::GraphemeCursor">GraphemeCursor</a>',
          1,
          ['unicode_segmentation::grapheme::GraphemeCursor'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="unicode_segmentation/struct.GraphemeIndices.html" title="struct unicode_segmentation::GraphemeIndices">GraphemeIndices</a>&lt;\'a&gt;',
          1,
          ['unicode_segmentation::grapheme::GraphemeIndices'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="unicode_segmentation/struct.Graphemes.html" title="struct unicode_segmentation::Graphemes">Graphemes</a>&lt;\'a&gt;',
          1,
          ['unicode_segmentation::grapheme::Graphemes'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="unicode_segmentation/struct.USentenceBoundIndices.html" title="struct unicode_segmentation::USentenceBoundIndices">USentenceBoundIndices</a>&lt;\'a&gt;',
          1,
          ['unicode_segmentation::sentence::USentenceBoundIndices'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="unicode_segmentation/struct.USentenceBounds.html" title="struct unicode_segmentation::USentenceBounds">USentenceBounds</a>&lt;\'a&gt;',
          1,
          ['unicode_segmentation::sentence::USentenceBounds'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="unicode_segmentation/struct.UWordBoundIndices.html" title="struct unicode_segmentation::UWordBoundIndices">UWordBoundIndices</a>&lt;\'a&gt;',
          1,
          ['unicode_segmentation::word::UWordBoundIndices'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="unicode_segmentation/struct.UWordBounds.html" title="struct unicode_segmentation::UWordBounds">UWordBounds</a>&lt;\'a&gt;',
          1,
          ['unicode_segmentation::word::UWordBounds'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="unicode_segmentation/struct.UnicodeSentences.html" title="struct unicode_segmentation::UnicodeSentences">UnicodeSentences</a>&lt;\'a&gt;',
          1,
          ['unicode_segmentation::sentence::UnicodeSentences'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="unicode_segmentation/struct.UnicodeWordIndices.html" title="struct unicode_segmentation::UnicodeWordIndices">UnicodeWordIndices</a>&lt;\'a&gt;',
          1,
          ['unicode_segmentation::word::UnicodeWordIndices'],
        ],
        [
          'impl&lt;\'a&gt; UnsafeUnpin for <a class="struct" href="unicode_segmentation/struct.UnicodeWords.html" title="struct unicode_segmentation::UnicodeWords">UnicodeWords</a>&lt;\'a&gt;',
          1,
          ['unicode_segmentation::word::UnicodeWords'],
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
//{"start":57,"fragment_lengths":[7557,905,925,1172,149,649,6119,31151,3983,3450,1836,2029,6284,7572,24205,15152,153,1082,8066,5038,48085,2741]}
