const URL_SCHEME_PATTERN = /^[a-z][a-z\d+\-.]*:/i

const normalizeBasePath = (basePath: string): string => {
  if (!basePath || basePath === '/') {
    return ''
  }

  return basePath.endsWith('/') ? basePath.slice(0, -1) : basePath
}

export const resolveAssetUrl = (
  assetUrl: string | undefined,
  basePath = import.meta.env.BASE_URL,
): string | undefined => {
  if (!assetUrl) {
    return undefined
  }

  if (URL_SCHEME_PATTERN.test(assetUrl) || assetUrl.startsWith('//')) {
    return assetUrl
  }

  const normalizedBase = normalizeBasePath(basePath)
  if (assetUrl.startsWith('/')) {
    return `${normalizedBase}${assetUrl}`
  }

  return normalizedBase ? `${normalizedBase}/${assetUrl}` : `/${assetUrl}`
}
