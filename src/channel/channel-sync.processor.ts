import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

@Processor('channel-sync')
export class ChannelSyncProcessor {
  private readonly logger = new Logger(ChannelSyncProcessor.name);

  @Process('sync-availability')
  async handleAvailabilitySync(job: Job) {
    this.logger.log(
      `Processing availability sync job ${job.id} for payload: ${JSON.stringify(job.data)}`,
    );
    // In production: call OTA API. Here: simulate success.
    await new Promise((r) => setTimeout(r, 100));
    this.logger.log(`Availability sync job ${job.id} completed`);
    return { success: true };
  }

  @Process('push-rates')
  async handleRatePush(job: Job) {
    this.logger.log(`Processing rate push job ${job.id}`);
    await new Promise((r) => setTimeout(r, 100));
    return { success: true };
  }
}
