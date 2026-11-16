export type Platform = 'facebook' | 'instagram';
export type ContentStatus = 'draft' | 'awaiting_approval' | 'approved' | 'rejected' | 'published';
export interface Campaign { id: string; title: string; objective: string; theme: string; products: string; startDate: string; months: number; status: 'draft' | 'approved' | 'rejected'; createdAt: string }
export interface ContentVersion { id: string; postId: string; number: number; caption: string; createdAt: string }
export interface Post { id: string; campaignId?: string; title: string; platform: Platform; format: 'image' | 'video'; scheduledDate: string; status: ContentStatus; versionId: string; createdAt: string }
export interface Approval { id: string; entityId: string; entityType: 'campaign' | 'content'; versionId?: string; decision: 'approved' | 'rejected' | 'revision_requested'; createdAt: string }
export interface Job { id: string; postId: string; scheduledDate: string; status: 'queued' | 'generating' | 'awaiting_approval' | 'ready' | 'published' | 'failed'; error?: string }
export interface JobAttempt { id: string; jobId: string; startedAt: string; finishedAt?: string; error?: string; correlationId: string }
export interface ActivityLog { id: string; timestamp: string; severity: 'info' | 'warning' | 'error'; service: 'planner' | 'content' | 'settings' | 'system'; message: string; correlationId: string; jobId?: string; details?: string }
export interface AuditEntry { id: string; entityId: string; action: string; timestamp: string }
export interface AnalyticsRecord { id: string; platform: Platform; date: string; campaignId?: string; reach: number; impressions: number; engagements: number; views: number }
export interface ChatMessage { id: string; content: string; createdAt: string }
export interface Settings { businessName: string; website: string; timezone: string; guidelines: string; model: string; budget: number; leadDays: number; imageCadence: number; videosPerWeek: number }
export interface MarketingState { campaigns: Campaign[]; posts: Post[]; versions: ContentVersion[]; approvals: Approval[]; jobs: Job[]; attempts: JobAttempt[]; logs: ActivityLog[]; audit: AuditEntry[]; analytics: AnalyticsRecord[]; messages: ChatMessage[]; settings: Settings }
// Future server adapters must authorize each operation and enforce version-specific approval.
export interface MarketingAgentService { proposePlan(brief: string): Promise<Campaign>; requestContent(postId: string): Promise<{ jobId: string }>; }
export interface PublishingService { publishApprovedVersion(postId: string, versionId: string): Promise<{ externalId: string }>; }
