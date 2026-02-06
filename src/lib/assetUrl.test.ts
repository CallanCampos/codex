import { resolveAssetUrl } from './assetUrl'

describe('resolveAssetUrl', () => {
  it('returns absolute URLs unchanged', () => {
    expect(resolveAssetUrl('https://example.com/a.dae', '/repo/')).toBe(
      'https://example.com/a.dae',
    )
  })

  it('prefixes root-relative URLs with vite base path', () => {
    expect(resolveAssetUrl('/models/xy/vaporeon/model.dae', '/pokemon-size-journey/')).toBe(
      '/pokemon-size-journey/models/xy/vaporeon/model.dae',
    )
  })

  it('keeps root-relative URLs for root base path', () => {
    expect(resolveAssetUrl('/models/xy/vaporeon/model.dae', '/')).toBe(
      '/models/xy/vaporeon/model.dae',
    )
  })
})
