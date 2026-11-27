import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class PrintService {
  private readonly sb = inject(SupabaseService);
  private readonly helperUrl = 'http://127.0.0.1:17655';
  private pollTimer: any = null;

  async isLocalHelperReady(): Promise<boolean> {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 650);
      const res = await fetch(`${this.helperUrl}/health`, { cache: 'no-store', signal: ctl.signal });
      clearTimeout(t);
      return res.ok;
    } catch {
      return false;
    }
  }

  async sendToCitizen(imageDataUrl: string) {
    const res = await fetch(`${this.helperUrl}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ printer: 'CITIZEN CT-D150', imageDataUrl, widthMm: 80, cut: true }),
    });
    if (!res.ok) throw new Error(await res.text());
  }

  async printThermalOrQueue(imageDataUrl: string) {
    const localUp = await this.isLocalHelperReady();
    if (localUp) {
      await this.sendToCitizen(imageDataUrl);
      this.sb.say('Printed on Citizen CT-D150');
      return;
    }
    const cfg = this.sb.pdfSettings();
    const ctx = this.sb.context();
    if (cfg.remotePrintFromMobile && ctx?.shop_id) {
      const { error } = await this.sb.client.from('goldleaf_print_jobs').insert({
        shop_id: ctx.shop_id,
        printer: 'CITIZEN CT-D150',
        image_data_url: imageDataUrl,
        width_mm: 80,
        status: 'pending',
      });
      if (error) throw error;
      this.sb.say('Sent to Laptop Citizen Print Station!');
      return;
    }
    throw new Error('Citizen printer helper not found on this device.');
  }

  startStationPolling() {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => this.pollRemoteJobs(), 3000);
  }

  async pollRemoteJobs(manual = false) {
    const cfg = this.sb.pdfSettings();
    const ctx = this.sb.context();
    if ((!cfg.remotePrintStation && !cfg.remotePrintFromMobile && !manual) || !ctx?.shop_id) return;
    if (!(await this.isLocalHelperReady())) {
      if (manual) this.sb.say('Citizen print helper is not running on this laptop.');
      return;
    }
    const { data, error } = await this.sb.client
      .from('goldleaf_print_jobs')
      .select('id,image_data_url')
      .eq('shop_id', ctx.shop_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(5);
    if (error || !data?.length) {
      if (manual) this.sb.say('No pending mobile print jobs.');
      return;
    }
    for (const job of data) {
      try {
        await this.sendToCitizen(job.image_data_url);
        await this.sb.client
          .from('goldleaf_print_jobs')
          .update({ status: 'printed', printed_at: new Date().toISOString() })
          .eq('id', job.id);
        this.sb.say('Printed mobile job on Citizen CT-D150');
      } catch (e: any) {
        await this.sb.client
          .from('goldleaf_print_jobs')
          .update({ status: 'error', error_message: String(e?.message || e) })
          .eq('id', job.id);
      }
    }
  }
}
