import { Injectable } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import { ReportsService } from './reports.service';

@Injectable()
export class PdfReportService {
  constructor(private readonly reports: ReportsService) {}

  async generatePdf(
    propertyId: string,
    type: string,
    startDate: string,
    endDate: string,
    groupBy?: string,
    propertyName?: string,
  ): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    return new Promise(async (resolve, reject) => {
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.addHeader(doc, type, startDate, endDate, propertyName);

      switch (type) {
        case 'occupancy':
          await this.renderOccupancy(doc, propertyId, startDate, endDate, groupBy);
          break;
        case 'revenue':
          await this.renderRevenue(doc, propertyId, startDate, endDate, groupBy);
          break;
        case 'bookings-by-source':
          await this.renderBookingsBySource(doc, propertyId, startDate, endDate);
          break;
        case 'financial-summary':
          await this.renderFinancialSummary(doc, propertyId, startDate, endDate);
          break;
        case 'tax':
          await this.renderTax(doc, propertyId, startDate, endDate, groupBy);
          break;
        case 'refunds':
          await this.renderRefunds(doc, propertyId, startDate, endDate);
          break;
        case 'outstanding-balances':
          await this.renderOutstandingBalances(doc, propertyId);
          break;
        case 'payment-methods':
          await this.renderPaymentMethods(doc, propertyId, startDate, endDate);
          break;
        default:
          doc.fontSize(14).text(`Unknown report type: ${type}`);
      }

      doc.end();
    });
  }

  private addHeader(
    doc: PDFKit.PDFDocument,
    type: string,
    startDate: string,
    endDate: string,
    propertyName?: string,
  ) {
    const title = type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') + ' Report';
    doc.fontSize(20).text(title, { align: 'center' });
    if (propertyName) {
      doc.fontSize(12).text(propertyName, { align: 'center' });
    }
    doc.fontSize(10).text(`${startDate} to ${endDate}`, { align: 'center' });
    doc.text(`Generated: ${new Date().toISOString().slice(0, 10)}`, { align: 'center' });
    doc.moveDown(2);
  }

  private drawTable(doc: PDFKit.PDFDocument, headers: string[], rows: string[][], colWidths?: number[]) {
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const cols = headers.length;
    const widths = colWidths || headers.map(() => Math.floor(pageWidth / cols));
    const startX = doc.page.margins.left;
    let y = doc.y;

    doc.fontSize(9).font('Helvetica-Bold');
    let x = startX;
    for (let i = 0; i < cols; i++) {
      doc.text(headers[i], x, y, { width: widths[i], continued: false });
      x += widths[i];
    }
    y += 18;
    doc.moveTo(startX, y).lineTo(startX + widths.reduce((a, b) => a + b, 0), y).stroke();
    y += 4;

    doc.font('Helvetica').fontSize(8);
    for (const row of rows) {
      if (y > doc.page.height - 80) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      x = startX;
      for (let i = 0; i < cols; i++) {
        doc.text(String(row[i] ?? ''), x, y, { width: widths[i], continued: false });
        x += widths[i];
      }
      y += 15;
    }
    doc.y = y + 10;
  }

  private async renderOccupancy(doc: PDFKit.PDFDocument, propertyId: string, startDate: string, endDate: string, groupBy?: string) {
    const data: any = await this.reports.occupancyReport(propertyId, startDate, endDate, groupBy);
    doc.fontSize(12).text('Overall');
    doc.fontSize(10)
      .text(`Occupancy Rate: ${data.overall.occupancyRate}%`)
      .text(`Nights Available: ${data.overall.totalNightsAvailable}`)
      .text(`Nights Sold: ${data.overall.totalNightsSold}`);
    doc.moveDown();

    if (data.periods?.length) {
      doc.fontSize(12).text('By Period');
      this.drawTable(doc, ['Period', 'Occupancy %', 'Nights Sold'],
        data.periods.map((p: any) => [p.period, String(p.occupancyRate), String(p.nightsSold)]));
    }

    if (data.byRoomType?.length) {
      doc.fontSize(12).text('By Room Type');
      this.drawTable(doc, ['Room Type', 'Occupancy %', 'Nights Sold'],
        data.byRoomType.map((r: any) => [r.roomType, String(r.occupancyRate), String(r.nightsSold)]));
    }
  }

  private async renderRevenue(doc: PDFKit.PDFDocument, propertyId: string, startDate: string, endDate: string, groupBy?: string) {
    const data = await this.reports.revenueReport(propertyId, startDate, endDate, groupBy);
    doc.fontSize(12).text('Overall');
    doc.fontSize(10)
      .text(`Total Revenue: R ${data.overall.totalRevenue.toFixed(2)}`)
      .text(`Payments: ${data.overall.paymentCount}`);
    doc.moveDown();

    if (data.periods?.length) {
      doc.fontSize(12).text('By Period');
      this.drawTable(doc, ['Period', 'Revenue (ZAR)', 'Payments'],
        data.periods.map((p: any) => [p.period, p.revenue.toFixed(2), String(p.paymentCount)]));
    }
    if (data.byProvider?.length) {
      doc.fontSize(12).text('By Provider');
      this.drawTable(doc, ['Provider', 'Revenue (ZAR)', 'Payments'],
        data.byProvider.map((p: any) => [p.provider, p.revenue.toFixed(2), String(p.paymentCount)]));
    }
  }

  private async renderBookingsBySource(doc: PDFKit.PDFDocument, propertyId: string, startDate: string, endDate: string) {
    const data = await this.reports.bookingsBySource(propertyId, startDate, endDate);
    this.drawTable(doc, ['Source', 'Bookings', 'Revenue (ZAR)', 'Avg Value'],
      data.map((r: any) => [r.source, String(r.bookingCount), r.totalRevenue.toFixed(2), r.avgBookingValue.toFixed(2)]));
  }

  private async renderFinancialSummary(doc: PDFKit.PDFDocument, propertyId: string, startDate: string, endDate: string) {
    const data = await this.reports.financialSummary(propertyId, startDate, endDate);
    const rows = [
      ['Gross Revenue', `R ${data.grossRevenue.toFixed(2)}`],
      ['Total Refunds', `R ${data.totalRefunds.toFixed(2)}`],
      ['Net Revenue', `R ${data.netRevenue.toFixed(2)}`],
      ['VAT (15%)', `R ${data.vatAmount.toFixed(2)}`],
      ['Revenue Ex VAT', `R ${data.revenueExVat.toFixed(2)}`],
      ['Deposits Collected', `R ${data.depositsCollected.toFixed(2)}`],
      ['Balances Collected', `R ${data.balancesCollected.toFixed(2)}`],
      ['Full Payments', `R ${data.fullPayments.toFixed(2)}`],
      ['Completed', String(data.completedPayments)],
      ['Failed', String(data.failedPayments)],
      ['Pending', String(data.pendingPayments)],
    ];
    this.drawTable(doc, ['Metric', 'Value'], rows, [250, 200]);
  }

  private async renderTax(doc: PDFKit.PDFDocument, propertyId: string, startDate: string, endDate: string, groupBy?: string) {
    const data = await this.reports.taxReport(propertyId, startDate, endDate, groupBy);
    this.drawTable(doc, ['Period', 'Gross', 'Refunds', 'Net', 'VAT', 'Ex VAT'],
      data.map((p: any) => [
        p.period,
        p.grossRevenue.toFixed(2),
        p.refunds.toFixed(2),
        p.netRevenue.toFixed(2),
        p.vatAmount.toFixed(2),
        p.revenueExVat.toFixed(2),
      ]));
  }

  private async renderRefunds(doc: PDFKit.PDFDocument, propertyId: string, startDate: string, endDate: string) {
    const data = await this.reports.refundReport(propertyId, startDate, endDate);
    doc.fontSize(12).text('Summary');
    doc.fontSize(10)
      .text(`Total Refunds: ${data.summary.totalRefunds}`)
      .text(`Total Amount: R ${data.summary.totalAmount.toFixed(2)}`)
      .text(`Avg Amount: R ${data.summary.avgAmount.toFixed(2)}`);
    doc.moveDown();

    if (data.byReason?.length) {
      doc.fontSize(12).text('By Reason');
      this.drawTable(doc, ['Reason', 'Count', 'Total (ZAR)'],
        data.byReason.map((r: any) => [r.reason || 'N/A', String(r.count), r.totalAmount.toFixed(2)]));
    }

    doc.fontSize(10).text(`Pending: ${data.pending.count} (R ${data.pending.totalAmount.toFixed(2)})`);
  }

  private async renderOutstandingBalances(doc: PDFKit.PDFDocument, propertyId: string) {
    const data = await this.reports.outstandingBalancesReport(propertyId);
    doc.fontSize(12).text('Summary');
    doc.fontSize(10)
      .text(`Total Outstanding: R ${data.totalOutstanding.toFixed(2)}`)
      .text(`Bookings: ${data.bookingCount}`)
      .text(`Due ≤7 days: R ${data.aging.within7Days.toFixed(2)}`)
      .text(`Due ≤30 days: R ${data.aging.within30Days.toFixed(2)}`)
      .text(`Due >30 days: R ${data.aging.over30Days.toFixed(2)}`);
    doc.moveDown();

    if (data.bookings?.length) {
      this.drawTable(doc, ['Reference', 'Check-in', 'Total', 'Paid', 'Balance'],
        data.bookings.map((b: any) => [
          b.referenceNumber,
          String(b.checkIn).slice(0, 10),
          b.totalPrice.toFixed(2),
          b.paid.toFixed(2),
          b.balance.toFixed(2),
        ]));
    }
  }

  private async renderPaymentMethods(doc: PDFKit.PDFDocument, propertyId: string, startDate: string, endDate: string) {
    const data = await this.reports.paymentMethodBreakdown(propertyId, startDate, endDate);
    this.drawTable(doc, ['Provider', 'Type', 'Count', 'Total (ZAR)', 'Avg (ZAR)'],
      data.map((r: any) => [r.provider, r.paymentType, String(r.count), r.totalAmount.toFixed(2), r.avgAmount.toFixed(2)]));
  }
}
