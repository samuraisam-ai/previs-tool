import { reactive } from 'vue'

// Which top-level view is showing, and where inside Setups the user is.
export type AppView = 'plan' | 'live' | 'setups' | 'guide'
export type SceneTab = 'setups' | 'storyboard'

export const nav = reactive({
  view: 'plan' as AppView,
  productionId: null as string | null,
  sceneId: null as string | null,
  sceneTab: 'setups' as SceneTab
})

export function openSetups(productionId: string | null = null, sceneId: string | null = null, tab?: SceneTab): void {
  nav.productionId = productionId
  nav.sceneId = sceneId
  if (tab) nav.sceneTab = tab
  nav.view = 'setups'
}
