

# Appendix H - Erasure Coding - tiny edition

_Background: This is a "tiny" edition (V=6, C=2) of [GP Appendix H](https://graypaper.fluffylabs.dev/#/9a08063/394401394401?v=0.6.6).  The goal here is to accelerate multi-client JAM Testnets with a clear reference implementation utilizing GP-compliant third-party libraries, test cases for both segment (W_G=4104) and work package bundles (10 bytes, 272 bytes).  The entirety of what follows is a simple search-replace operation of Appendix H, which describes erasure encoding for a "full" JAM chain (V=1023, C=341)._

The foundation of the data-availability and distribution system of **JAM** is a systematic Reed-Solomon erasure coding function in $\mathrm{GF}(2^{16})$ of rate $2{:}6$.  We use a little-endian $\mathbb{Y}_2$ form of the 16-bit GF points with a functional equivalence given by $\mathcal{E}_2$.  
From this we may assume the encoding function:

$$
\mathcal{C} : [\mathbb{Y}_2]_{2} \to [\mathbb{Y}_2]_{6}
$$

and the recovery function:

$$
\mathcal{R} : \mathcal{P}((\mathbb{Y}_2, \mathbb{N}_{6}))_{2} \to [\mathbb{Y}_2]_{2}.
$$

Encoding is done by extrapolating a data blob of size 4 octets (provided in $\mathcal{C}$ here as 2 octet pairs) into 6 octet pairs.  

Recovery is done by collecting together any distinct 2 octet pairs, together with their indices, and transforming this into the original sequence of 2 octet pairs.

Practically speaking, this allows for the efficient encoding and recovery of data whose size is a multiple of 4 octets. Data whose length is not divisible by 4 must be padded (we pad with zeroes). We use this erasure-coding in two contexts within the **JAM** protocol:

- one where we encode variable sized (but typically very large) data blobs for the **Audit DA** (work package bundle) and **block-distribution** system, and 
- the other where we encode much smaller fixed-size **data segments** for the **Import DA** system.

For the **Import DA** system, we deal with an input size of $W_G=4,104$ octets, resulting in data-parallelism of order 1,026. We may attain a greater degree of data parallelism if encoding or recovering more than one segment at a time. 
Though for recovery, we may be restricted to requiring each segment to be formed from the same set of indices (depending on the specific algorithm).


## H.1 Blob Encoding and Recovery

We assume some data blob $\mathbf{d} \in \mathbb{Y}_{4k}, k \in \mathbb{N}$.  We are able to express this as a whole number of $k$ pieces each of a sequence of 4 octets. 

We denote these (data-parallel) pieces $\mathbf{p} \in \mathbb{Y}_{4} = \text{unzip}_{4}(\mathbf{d})$.   Each piece is then reformed as 2 octet pairs and erasure-coded using $\mathcal{C}$ as above to give 6 octet pairs per piece.

The resulting matrix is grouped by its pair-index and concatenated to form 6 *chunks*, each of $k$ octet-pairs.  Any 2 of these chunks may then be used to reconstruct the original data $\mathbf{d}$.

Formally we begin by defining four utility functions for splitting some large sequence into a number of equal-sized sub-sequences and for reconstituting such subsequences back into a single large sequence:

$\text{(H.1)} \quad \forall n \in \mathbb{N}, k \in \mathbb{N}: \text{split}_n(\mathbf{d} \in \mathbb{Y}_{k:n}) \in [\mathbb{Y}_n]_k \equiv [\mathbf{d}_{0\cdots +n}, \mathbf{d}_{n\cdots +n}, \ldots, \mathbf{d}_{(k-1)n\cdots +n}]$

$\text{(H.2)} \quad \forall n \in \mathbb{N}, k \in \mathbb{N}: \text{join}_n(\mathbf{c} \in [\mathbb{Y}_n]_k) \in \mathbb{Y}_{k:n} \equiv \mathbf{c}_0 \frown \mathbf{c}_1 \frown \ldots$

$\text{(H.3)} \quad \forall n \in \mathbb{N}, k \in \mathbb{N}: \text{unzip}_n(\mathbf{d} \in \mathbb{Y}_{k:n}) \in [\mathbb{Y}_n]_k \equiv \{[\mathbf{d}_{j \cdot k + i} \mid j \in \mathbb{N}_k] \mid i \in \mathbb{N}_k\}$

$\text{(H.4)} \quad \forall n \in \mathbb{N}, k \in \mathbb{N}: \text{lace}_n(\mathbf{c} \in \mathbb{Y}_n^k) \in \mathbb{Y}_{k:n} \equiv \mathbf{d} \text{ where } \forall i \in \mathbb{N}_k, j \in \mathbb{N}_n: \mathbf{d}_{j \cdot k  + i} = (\mathbf{c}_i)_j$

We define the transposition operator hence:

$\text{(H.5)} \quad ^\mathsf{T}[[\mathbf{x}_{0,0}, \mathbf{x}_{0,1}, \mathbf{x}_{0,2}, \ldots], [\mathbf{x}_{1,0}, \mathbf{x}_{1,1}, \ldots], \ldots] \equiv [[\mathbf{x}_{0,0}, \mathbf{x}_{1,0}, \mathbf{x}_{2,0}, \ldots], [\mathbf{x}_{0,1}, \mathbf{x}_{1,1}, \ldots], \ldots]$

We may then define our erasure-code chunking function which accepts an arbitrary sized data blob whose length divides wholly into 4 octets and results in 6 sequences of sequences each of smaller blobs:

$\text{(H.6)} \quad
\mathcal{C}_{k \in \mathbb{N}}:
\begin{cases}
\mathbb{Y}_{4k} \to [\mathbb{Y}_{2k}]_{6} \\
\mathbf{d} \mapsto [\text{join}(\mathbf{c}) \mid \mathbf{c} \in {}^\mathsf{T}[\mathcal{C}(\mathbf{p}) \mid \mathbf{p} \in \text{unzip}_{4}(\mathbf{d})]]
\end{cases}$

The original data may be reconstructed with any 2 of the 6 resultant items (along with their indices). 

If the original 2 items are known then reconstruction is just their concatenation:

$$
\text{(H.7)} \quad
\mathcal{R}_{k \in \mathbb{N}}:
\begin{cases}
\{ ( \mathbb{Y}_{2k}, \mathbb{N}_{6})\}_{2}\} \to \mathbb{Y}_{4k} \\
\mathbf{c} \mapsto
\begin{cases}
\mathcal{E}([\mathbf{x} | (\mathbf{x}, i ) \in \mathbf{c}) & \text{if } [i \mid (\mathbf{x}, i) \in \mathbf{c}] = [0, 1] \\
\text{lace}_k([\mathcal{R}((\text{split}_2(\mathbf{x})_p, i) \mid (\mathbf{x}, i) \in \mathbf{c}) \mid p \in \mathbb{N}_k & \text{always}
\end{cases}
\end{cases}
$$

Segment encoding/decoding ($W_G=4,104$) may be done using the same functions albeit with a constant $k = 1026$.


## Rust Implementation 

[Erasure encoding / decoding test vectors using reed-solomon-simd 3.0.1 #63](https://github.com/davxy/jam-test-vectors/pull/63) uses [reed-solomon-simd 3.0.1](https://docs.rs/reed-solomon-simd/3.0.1/reed_solomon_simd/) and demonstrates 10, 272, 4104 byte erasure encoding for tiny + full.

[`test_bundle_10_tiny.json`](https://github.com/davxy/jam-test-vectors/blob/92cc230383827c47a87da2f8fc36b215b573a112/erasure_coding/test_bundle_10_tiny.json) matches the diagram below: 

![image](https://hackmd.io/_uploads/HJ66fHrGxg.png)

It is unknown if `polkajam` follows the above.


Notes:
* See also: [RFC 139 - Faster Erasure Coding](https://github.com/ordian/RFCs/blob/main/text/0139-faster-erasure-coding.md)
* The above RS package does NOT need any kind of 64 byte alignment, but does require 2 byte alignment.  



