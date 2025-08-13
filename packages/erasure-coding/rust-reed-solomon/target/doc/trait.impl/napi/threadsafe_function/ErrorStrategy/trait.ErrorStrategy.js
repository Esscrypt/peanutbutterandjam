;(() => {
  var implementors = Object.fromEntries([['napi', []]])
  if (window.register_implementors) {
    window.register_implementors(implementors)
  } else {
    window.pending_implementors = implementors
  }
})()
//{"start":57,"fragment_lengths":[11]}
