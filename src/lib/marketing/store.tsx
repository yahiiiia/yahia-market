import { createContext, useContext, useState, ReactNode } from 'react';
import { toast } from 'sonner';
import { addMonths, format, subDays } from 'date-fns';
import { MarketingState, Campaign, Post, Settings, ActivityLog } from './types';

const key = 'yahia-marketing-foundation-v1';
const initial: MarketingState = { campaigns: [], posts: [], versions: [], approvals: [], jobs: [], attempts: [], logs: [], audit: [], analytics: [], messages: [], settings: { businessName: 'Yahia Market', website: 'https://yahiamarket.com', timezone: 'Africa/Casablanca', guidelines: 'Fresh, friendly, and proudly Moroccan. Make everyday shopping feel simple. Use clear, welcoming language in Darija and French.', model: 'Not configured', budget: 0, leadDays: 5, imageCadence: 2, videosPerWeek: 1 } };
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
function load(): MarketingState {
  try { const value = JSON.parse(localStorage.getItem(key) || 'null'); if (value && Object.keys(initial).every(k => k in value) && Object.keys(initial).filter(k => k !== 'settings').every(k => Array.isArray(value[k]))) return value; } catch { /* Start empty when local storage is unavailable. */ }
  return initial;
}
type Store = { state: MarketingState; createCampaign: (input: Pick<Campaign, 'title' | 'objective' | 'theme' | 'products' | 'startDate' | 'months'>) => void; decideCampaign: (id: string, decision: 'approved' | 'rejected' | 'revision_requested') => void; savePost: (input: Pick<Post, 'title' | 'platform' | 'format' | 'scheduledDate'>, caption: string, postId?: string) => void; submitPost: (id: string) => void; decidePost: (id: string, decision: 'approved' | 'rejected' | 'revision_requested') => void; saveSettings: (settings: Settings) => void; saveMessage: (content: string) => void };
const Context = createContext<Store | null>(null);
export function MarketingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MarketingState>(load);
  function commit(update: (s: MarketingState) => MarketingState, service: ActivityLog['service'], message: string, entityId?: string) {
    const timestamp = now();
    const next = update(state);
    next.logs = [{ id: id(), timestamp, severity: 'info', service, message, correlationId: id() }, ...next.logs];
    next.audit = [...next.audit, { id: id(), entityId: entityId || 'workspace', action: message, timestamp }];
    setState(next);
    try { localStorage.setItem(key, JSON.stringify(next)); toast.success(message, { description: 'Saved in this browser only.' }); } catch { toast.warning('Changed for this session only. Browser storage is unavailable or full.'); }
  }
  function createCampaign(input: Pick<Campaign, 'title' | 'objective' | 'theme' | 'products' | 'startDate' | 'months'>) {
    const campaign: Campaign = { ...input, id: id(), status: 'draft', createdAt: now() };
    commit(s => ({ ...s, campaigns: [...s.campaigns, campaign] }), 'planner', 'Plan created', campaign.id);
  }
  function decideCampaign(campaignId: string, decision: 'approved' | 'rejected' | 'revision_requested') {
    const campaign = state.campaigns.find(c => c.id === campaignId);
    if (!campaign || campaign.status === 'approved') return;
    commit(s => {
      const posts = [...s.posts], versions = [...s.versions], jobs = [...s.jobs];
      if (decision === 'approved') {
        const start = new Date(`${campaign.startDate}T12:00:00`), end = addMonths(start, campaign.months);
        const localDate = (d: Date) => format(d, 'yyyy-MM-dd');
        for (let day = 0, date = new Date(start); date < end; day++, date.setDate(date.getDate() + 1)) {
          const formats: ('image' | 'video')[] = [];
          if (day % s.settings.imageCadence === 0) formats.push('image');
          if (s.settings.videosPerWeek && day % 7 === 6) formats.push('video');
          for (const format of formats) for (const platform of ['facebook', 'instagram'] as const) {
            const postId = id(), versionId = id(), generation = new Date(date); generation.setDate(generation.getDate() - s.settings.leadDays);
            posts.push({ id: postId, versionId, campaignId, title: `${campaign.title} · ${format}`, platform, format, scheduledDate: localDate(date), status: 'draft', createdAt: now() });
            versions.push({ id: versionId, postId, number: 1, caption: '', createdAt: now() });
            jobs.push({ id: id(), postId, scheduledDate: localDate(generation), status: 'queued' });
          }
        }
      }
      return { ...s, campaigns: s.campaigns.map(c => c.id === campaignId ? { ...c, status: decision === 'revision_requested' ? 'draft' : decision } : c), posts, versions, jobs, approvals: [...s.approvals, { id: id(), entityId: campaignId, entityType: 'campaign', decision, createdAt: now() }] };
    }, 'planner', decision === 'approved' ? 'Plan approved; draft calendar slots created' : decision === 'rejected' ? 'Plan rejected' : 'Plan returned to draft', campaignId);
  }
  function savePost(input: Pick<Post, 'title' | 'platform' | 'format' | 'scheduledDate'>, caption: string, postId?: string) {
    const pid = postId || id(), versionId = id();
    commit(s => ({ ...s, posts: postId ? s.posts.map(p => p.id === pid ? { ...p, ...input, versionId, status: 'draft' } : p) : [...s.posts, { ...input, id: pid, versionId, status: 'draft', createdAt: now() }], versions: [...s.versions, { id: versionId, postId: pid, number: s.versions.filter(v => v.postId === pid).length + 1, caption, createdAt: now() }], jobs: s.jobs.map(j => j.postId === pid ? { ...j, status: 'queued', scheduledDate: format(subDays(new Date(`${input.scheduledDate}T12:00:00`), s.settings.leadDays), 'yyyy-MM-dd') } : j) }), 'content', postId ? 'New content version saved; approval reset' : 'Content draft created', pid);
  }
  function submitPost(postId: string) {
    const post = state.posts.find(p => p.id === postId); if (!post || post.status !== 'draft') return;
    if (!state.versions.find(v => v.id === post.versionId)?.caption.trim()) { toast.error('Add a caption before requesting approval.'); return; }
    commit(s => ({ ...s, posts: s.posts.map(p => p.id === postId ? { ...p, status: 'awaiting_approval' } : p), jobs: s.jobs.map(j => j.postId === postId ? { ...j, status: 'awaiting_approval' } : j) }), 'content', 'Content submitted for approval', postId);
  }
  function decidePost(postId: string, decision: 'approved' | 'rejected' | 'revision_requested') {
    const post = state.posts.find(p => p.id === postId); if (!post || post.status !== 'awaiting_approval') return;
    const current = state.versions.find(v => v.id === post.versionId)!;
    const revision = decision === 'revision_requested' ? { ...current, id: id(), number: state.versions.filter(v => v.postId === postId).length + 1, createdAt: now() } : null;
    commit(s => ({ ...s, posts: s.posts.map(p => p.id === postId ? { ...p, status: decision === 'revision_requested' ? 'draft' : decision, versionId: revision?.id || p.versionId } : p), versions: revision ? [...s.versions, revision] : s.versions, jobs: s.jobs.map(j => j.postId === postId ? { ...j, status: decision === 'approved' ? 'ready' : 'queued' } : j), approvals: [...s.approvals, { id: id(), entityId: postId, entityType: 'content', versionId: post.versionId, decision, createdAt: now() }] }), 'content', decision === 'approved' ? 'Content approved; publishing remains disconnected' : decision === 'rejected' ? 'Content rejected' : 'Revision created as a new draft version', postId);
  }
  return <Context.Provider value={{ state, createCampaign, decideCampaign, savePost, submitPost, decidePost, saveSettings: settings => commit(s => ({ ...s, settings }), 'settings', 'Workspace settings saved'), saveMessage: content => commit(s => ({ ...s, messages: [...s.messages, { id: id(), content, createdAt: now() }] }), 'system', 'AI brief saved; no request sent') }}>{children}</Context.Provider>;
}
export function useMarketing() { const context = useContext(Context); if (!context) throw new Error('MarketingProvider is required'); return context; }
