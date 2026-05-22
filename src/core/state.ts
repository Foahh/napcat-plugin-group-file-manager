import type { NapCatPluginContext, PluginLogger } from 'napcat-types/napcat-onebot/network/plugin/types';
import { ConfigLoader } from '../config/loader';

class PluginState {
    private _ctx: NapCatPluginContext | null = null;

    lastRunAt: Map<string, number> = new Map();

    schedulerTimer: ReturnType<typeof setInterval> | null = null;

    get ctx(): NapCatPluginContext {
        if (!this._ctx) throw new Error('PluginState 尚未初始化，请先调用 init()');
        return this._ctx;
    }

    get logger(): PluginLogger {
        return this.ctx.logger;
    }

    init(ctx: NapCatPluginContext): void {
        this._ctx = ctx;
        this.ensureDataDirs();
    }

    cleanup(): void {
        if (this.schedulerTimer) {
            clearInterval(this.schedulerTimer);
            this.schedulerTimer = null;
        }
        this.lastRunAt.clear();
        this._ctx = null;
    }

    ensureDataDirs(): void {
        new ConfigLoader(this.ctx.dataPath).ensureDirs();
    }

    scheduleKey(groupId: string, ruleId: string): string {
        return `${groupId}:${ruleId}`;
    }

    getLastRun(key: string): number {
        return this.lastRunAt.get(key) ?? 0;
    }

    setLastRun(key: string, t: number): void {
        this.lastRunAt.set(key, t);
    }
}

export const pluginState = new PluginState();
