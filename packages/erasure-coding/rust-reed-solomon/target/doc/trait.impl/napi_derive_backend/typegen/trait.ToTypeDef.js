;(() => {
  var implementors = Object.fromEntries([['napi_derive_backend', []]])
  if (window.register_implementors) {
    window.register_implementors(implementors)
  } else {
    window.pending_implementors = implementors
  }
})()
//{"start":57,"fragment_lengths":[26]}
