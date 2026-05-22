import type { PluginConfigSchema, PluginModule } from 'napcat-types/napcat-onebot/network/plugin/types';
import { EventType } from 'napcat-types/napcat-onebot/event/index';

import { ConfigLoader } from './config/loader';
import { pluginState } from './core/state';
import { handleMessage } from './handlers/message-handler';
import { startScheduler, stopScheduler } from './handlers/scheduler';

export let plugin_config_ui = [] as PluginConfigSchema;

export const plugin_init: PluginModule['plugin_init'] = async (ctx) => {
  pluginState.init(ctx);
  const loader = new ConfigLoader(ctx.dataPath);
  loader.ensureDirs();
  const global = loader.loadGlobal();
  if (!global.enabled) {
    ctx.logger.info('群文件管理插件已加载');
    return;
  }
  startScheduler(ctx);
  ctx.logger.info('群文件管理插件已启动');
};

export const plugin_onmessage: PluginModule['plugin_onmessage'] = async (ctx, event) => {
  if (event.post_type !== EventType.MESSAGE) return;
  await handleMessage(ctx, event);
};

export const plugin_cleanup: PluginModule['plugin_cleanup'] = async (ctx) => {
  stopScheduler();
  pluginState.lastRunAt.clear();
  pluginState.cleanup();
  ctx.logger.info('群文件管理插件已卸载');
};

export const plugin_get_config = async () => ({ enabled: true });
export const plugin_set_config = async () => {};
