import { useState, useEffect } from 'react'

type Route =
  | { page: 'dashboard' }
  | { page: 'join'; sessionId: string }

function parseHash(hash: string): Route {
  const match = hash.match(/^#\/join\/(.+)$/)
  if (match) {
    return { page: 'join', sessionId: decodeURIComponent(match[1]) }
  }
  return { page: 'dashboard' }
}

export function useHashRouter(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash))

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return route
}
