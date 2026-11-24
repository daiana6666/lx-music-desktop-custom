
import fs from 'node:fs'
import path from 'node:path'

// === 诊断日志：记录推荐/登录 IPC 真实错误到用户目录 ===
const _diagLog = (msg: string) => {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  // 尝试多个可写位置，确保至少一处能落地
  const dirs = [
    (global as any).lx?.lxDataPath,
    (global as any).lx?.userDataPath,
    process.env.APPDATA ? path.join(process.env.APPDATA, 'lx-music-desktop-custom-diag') : '',
    process.cwd(),
  ].filter(Boolean) as string[]
  for (const dir of dirs) {
    try {
      fs.mkdirSync(dir, { recursive: true })
      fs.appendFileSync(path.join(dir, 'netease-diag.log'), line, 'utf8')
      break
    } catch { /* try next */ }
  }
}
import { WIN_MAIN_RENDERER_EVENT_NAME } from '@common/ipcNames'
import { mainHandle } from '@common/mainIpc'
import { assertRecommendationRequest, handleRecommendationSession } from '@main/services/recommendationSessions'
import {
  checkLoginQr,
  createLoginQr,
  getAccountStatus,
  getDailySongCategories,
  getHomeRecommendation,
  getNeteaseUserPlaylists,
  getMusicUrl,
  getPrivateFmSongs,
  getRecommendPlaylistDetail,
  getRecommendPlaylists,
  getRecommendSongs,
  likeMusic,
  logout,
  trashPrivateFmMusic,
} from '@main/modules/netease'


// 包裹 mainHandle：捕获异常并写日志，再原样抛出
const safeHandle: typeof mainHandle = ((name: any, handler: any) => {
  return (mainHandle as any)(name, async (...args: any[]) => {
    try {
      return await handler(...args)
    } catch (error: any) {
      const stack = error?.stack || String(error)
      _diagLog(`IPC ${String(name)} ERROR: ${stack}`)
      throw error
    }
  })
}) as typeof mainHandle

export default () => {
  safeHandle<LX.Netease.AccountStatus>(WIN_MAIN_RENDERER_EVENT_NAME.netease_get_account_status, async() => {
    return getAccountStatus()
  })

  safeHandle<LX.Netease.LoginQr>(WIN_MAIN_RENDERER_EVENT_NAME.netease_login_qr_create, async() => {
    return createLoginQr()
  })

  safeHandle<string, LX.Netease.LoginQrCheck>(WIN_MAIN_RENDERER_EVENT_NAME.netease_login_qr_check, async({ params: key }) => {
    return checkLoginQr(key)
  })

  mainHandle(WIN_MAIN_RENDERER_EVENT_NAME.netease_logout, async() => {
    await logout()
  })

  safeHandle<undefined, LX.Music.MusicInfoOnline[]>(WIN_MAIN_RENDERER_EVENT_NAME.netease_get_recommend_songs, async({ event }) => {
    assertRecommendationRequest('neteaseRecommend', event)
    return getRecommendSongs()
  })

  safeHandle<LX.Netease.PrivateFmParams & { continuation?: boolean }, LX.Music.MusicInfoOnline[]>(WIN_MAIN_RENDERER_EVENT_NAME.netease_get_private_fm, async({ event, params }) => {
    if (handleRecommendationSession('neteaseRecommend', 'fm', event, params)) return []
    assertRecommendationRequest('neteaseRecommend', event, params?.continuation === true ? 'fm' : undefined)
    return getPrivateFmSongs(params)
  })

  safeHandle<{ limit?: number, removePrivateRecommend?: boolean }, LX.Netease.Playlist[]>(WIN_MAIN_RENDERER_EVENT_NAME.netease_get_recommend_playlists, async({ event, params }) => {
    assertRecommendationRequest('neteaseRecommend', event)
    return getRecommendPlaylists(params?.limit, params?.removePrivateRecommend)
  })

  safeHandle<LX.Netease.HomeRecommendationParams, LX.Netease.HomeRecommendation>(WIN_MAIN_RENDERER_EVENT_NAME.netease_get_home_recommendation, async({ event, params }) => {
    assertRecommendationRequest('neteaseRecommend', event)
    return getHomeRecommendation(params)
  })

  safeHandle<undefined, LX.Netease.DailySongCategory[]>(WIN_MAIN_RENDERER_EVENT_NAME.netease_get_daily_song_categories, async({ event }) => {
    assertRecommendationRequest('neteaseRecommend', event)
    return getDailySongCategories()
  })

  safeHandle<readonly LX.PlatformPlaylistKind[] | undefined, LX.PlatformPlaylistSummary[]>(WIN_MAIN_RENDERER_EVENT_NAME.netease_get_user_playlist_summaries, async({ params }) => {
    return getNeteaseUserPlaylists(params)
  })

  safeHandle<LX.Netease.PlaylistDetailParams, LX.Netease.PlaylistDetailInfo>(WIN_MAIN_RENDERER_EVENT_NAME.netease_get_playlist_detail, async({ params }) => {
    return getRecommendPlaylistDetail(params.id, params.page)
  })

  safeHandle<LX.Netease.MusicUrlParams, string>(WIN_MAIN_RENDERER_EVENT_NAME.netease_get_music_url, async({ params }) => {
    return getMusicUrl(params.musicInfo, params.quality)
  })

  safeHandle<LX.Music.MusicInfo>(WIN_MAIN_RENDERER_EVENT_NAME.netease_like_music, async({ params: musicInfo }) => {
    await likeMusic(musicInfo)
  })

  safeHandle<LX.Netease.PrivateFmTrashParams>(WIN_MAIN_RENDERER_EVENT_NAME.netease_trash_private_fm_music, async({ params }) => {
    await trashPrivateFmMusic(params)
  })
}
