/**
 * Safe Project Opening Manager
 * Prevents SQLite UNIQUE constraint errors by managing project opening concurrency
 */

import { Alert } from 'react-native';

import { convertToExpoUrl, openUrl } from './UrlUtils';

interface ProjectOpenRequest {
  url: string;
  projectId: string;
  timestamp: number;
}

class SafeProjectOpener {
  private static instance: SafeProjectOpener;
  private activeOpens = new Map<string, Promise<void>>();
  private lastOpenTime = new Map<string, number>();
  private openHistory = new Map<string, ProjectOpenRequest[]>();

  // Configuration
  private readonly MIN_OPEN_INTERVAL = 2000; // Minimum 2 seconds between opens
  private readonly MAX_HISTORY_SIZE = 10; // Keep last 10 requests per project
  private readonly MAX_RETRIES = 3;

  static getInstance(): SafeProjectOpener {
    if (!SafeProjectOpener.instance) {
      SafeProjectOpener.instance = new SafeProjectOpener();
    }
    return SafeProjectOpener.instance;
  }

  /**
   * Safely opens a project with comprehensive protection against SQLite constraint errors
   */
  async openProject(tunnelUrl: string, projectId: string): Promise<void> {
    const now = Date.now();
    const lastOpen = this.lastOpenTime.get(projectId) || 0;
    const timeSinceLastOpen = now - lastOpen;

    // Check if we're trying to open too soon
    if (timeSinceLastOpen < this.MIN_OPEN_INTERVAL) {
      console.log('⏳ Project opening too soon, skipping...', {
        projectId,
        timeSinceLastOpen,
        minInterval: this.MIN_OPEN_INTERVAL,
      });
      return;
    }

    // Check if already opening this project
    if (this.activeOpens.has(projectId)) {
      console.log('⏳ Project already opening, skipping...', { projectId });
      return this.activeOpens.get(projectId)!;
    }

    // Record this request
    this.recordOpenRequest(tunnelUrl, projectId, now);

    // Create the opening promise for mobile projects
    const openPromise = this.performSafeOpen(tunnelUrl, projectId, now);
    this.activeOpens.set(projectId, openPromise);

    try {
      await openPromise;
      console.log('✅ Project opened successfully', { projectId });
    } catch (error) {
      console.error('❌ Failed to open project', { projectId, error });
      throw error;
    } finally {
      this.activeOpens.delete(projectId);
      this.lastOpenTime.set(projectId, now);
    }
  }

  /**
   * Performs the actual project opening with retry logic
   */
  private async performSafeOpen(
    tunnelUrl: string,
    projectId: string,
    _timestamp: number
  ): Promise<void> {
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        // Generate URL with sessionId for reliable native lookup
        const uniqueUrl = this.generateUniqueUrl(tunnelUrl, projectId);
        console.log(`🚀 Opening mobile project (attempt ${attempt}/${this.MAX_RETRIES})`, {
          projectId,
          originalUrl: tunnelUrl,
          uniqueUrl,
        });

        await openUrl(uniqueUrl);
        console.log('✅ Project opened successfully', { projectId, attempt });
        return; // Success!
      } catch (error) {
        console.error(`❌ Project open attempt ${attempt} failed`, {
          projectId,
          error: (error as Error).message,
        });

        // Check if this is a SQLite constraint error or native module error
        if (this.isSQLiteConstraintError(error) || this.isNativeModuleError(error)) {
          if (attempt < this.MAX_RETRIES) {
            const delay = this.calculateRetryDelay(attempt);
            console.log(
              `🔄 Retrying in ${delay}ms due to ${this.isSQLiteConstraintError(error) ? 'SQLite constraint' : 'native module'} error`
            );

            // CRITICAL FIX: Try to clean up database before retrying
            if (this.isSQLiteConstraintError(error)) {
              console.log('🧹 Attempting database cleanup before retry...');
              try {
                const { cleanupDuplicateUpdates } = await import('./SafeUpdatesModule');
                await cleanupDuplicateUpdates();
                console.log('✅ Database cleanup completed');
              } catch (cleanupError) {
                console.warn('⚠️ Database cleanup failed:', cleanupError);
              }
            }

            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          } else {
            // Final attempt failed - show user-friendly error
            Alert.alert(
              'Project Opening Error',
              'Unable to open project due to a system conflict. Please try again in a few moments.',
              [{ text: 'OK' }]
            );
            throw new Error('Project opening failed after all retries');
          }
        } else {
          // Non-SQLite error - don't retry
          throw error;
        }
      }
    }
  }

  /**
   * Generates URL for opening with sessionId for reliable native lookup
   */
  private generateUniqueUrl(tunnelUrl: string, sessionId: string): string {
    // Convert to exp:// format and include sessionId for direct lookup
    const expoUrl = convertToExpoUrl(tunnelUrl, sessionId);

    console.log('🔗 Generated URL:', {
      original: tunnelUrl,
      expo: expoUrl,
      sessionId,
    });

    return expoUrl;
  }

  /**
   * Records an open request for analytics and debugging
   */
  private recordOpenRequest(url: string, projectId: string, timestamp: number): void {
    const request: ProjectOpenRequest = { url, projectId, timestamp };

    if (!this.openHistory.has(projectId)) {
      this.openHistory.set(projectId, []);
    }

    const history = this.openHistory.get(projectId)!;
    history.push(request);

    // Keep only the most recent requests
    if (history.length > this.MAX_HISTORY_SIZE) {
      history.shift();
    }
  }

  /**
   * Checks if an error is related to SQLite constraint violations
   */
  private isSQLiteConstraintError(error: unknown): boolean {
    const errorMessage = (error as Error)?.message || '';
    return (
      errorMessage.includes('UNIQUE constraint failed') ||
      errorMessage.includes('SQLiteGetResultsError') ||
      errorMessage.includes('updates.id')
    );
  }

  /**
   * Checks if an error is related to native module access issues
   */
  private isNativeModuleError(error: unknown): boolean {
    const errorMessage = (error as Error)?.message || '';
    return (
      errorMessage.includes("native module that doesn't exist") ||
      errorMessage.includes("Cannot read property 'default' of undefined") ||
      errorMessage.includes('Invariant Violation')
    );
  }

  /**
   * Calculates retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    return Math.pow(2, attempt) * 1000 + Math.random() * 1000; // Add jitter
  }

  /**
   * Gets opening statistics for debugging
   */
  getOpeningStats(): { [projectId: string]: ProjectOpenRequest[] } {
    const stats: { [projectId: string]: ProjectOpenRequest[] } = {};
    this.openHistory.forEach((history, projectId) => {
      stats[projectId] = [...history];
    });
    return stats;
  }

  /**
   * Clears opening history (useful for testing)
   */
  clearHistory(): void {
    this.openHistory.clear();
    this.lastOpenTime.clear();
  }
}

// Export singleton instance
export const safeProjectOpener = SafeProjectOpener.getInstance();

// Convenience function
export const safeOpenProject = async (tunnelUrl: string, projectId: string): Promise<void> => {
  return safeProjectOpener.openProject(tunnelUrl, projectId);
};
