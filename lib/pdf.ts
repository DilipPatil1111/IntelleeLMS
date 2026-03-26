export function generateTranscriptHTML(data: {
  studentName: string;
  enrollmentNo: string;
  program: string;
  batch: string;
  results: {
    title: string;
    subject: string;
    type: string;
    date: string;
    score: number;
    totalMarks: number;
    percentage: number;
    status: string;
  }[];
  overallPercentage: number;
  attendanceRate: number;
}) {
  const rows = data.results
    .map(
      (r) => `
    <tr>
      <td style="border: 1px solid #e5e7eb; padding: 8px;">${r.title}</td>
      <td style="border: 1px solid #e5e7eb; padding: 8px;">${r.subject}</td>
      <td style="border: 1px solid #e5e7eb; padding: 8px;">${r.type}</td>
      <td style="border: 1px solid #e5e7eb; padding: 8px;">${r.date}</td>
      <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: center;">${r.score}/${r.totalMarks}</td>
      <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: center;">${r.percentage}%</td>
      <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: center; color: ${r.status === "PASS" ? "#16a34a" : "#dc2626"}; font-weight: bold;">${r.status}</td>
    </tr>`
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8" /><title>Transcript - ${data.studentName}</title></head>
    <body style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #4f46e5; margin-bottom: 4px;">Intellee College</h1>
        <h2 style="color: #374151; font-weight: normal;">Academic Transcript</h2>
      </div>
      
      <div style="margin-bottom: 24px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px;">
        <table style="width: 100%;">
          <tr><td style="padding: 4px 0; color: #6b7280;">Student Name:</td><td style="font-weight: bold;">${data.studentName}</td></tr>
          <tr><td style="padding: 4px 0; color: #6b7280;">Enrollment No:</td><td>${data.enrollmentNo}</td></tr>
          <tr><td style="padding: 4px 0; color: #6b7280;">Program:</td><td>${data.program}</td></tr>
          <tr><td style="padding: 4px 0; color: #6b7280;">Batch:</td><td>${data.batch}</td></tr>
          <tr><td style="padding: 4px 0; color: #6b7280;">Overall Score:</td><td style="font-weight: bold;">${data.overallPercentage}%</td></tr>
          <tr><td style="padding: 4px 0; color: #6b7280;">Attendance Rate:</td><td>${data.attendanceRate}%</td></tr>
        </table>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <thead>
          <tr style="background: #f9fafb;">
            <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: left;">Assessment</th>
            <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: left;">Subject</th>
            <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: left;">Type</th>
            <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: left;">Date</th>
            <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: center;">Score</th>
            <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: center;">%</th>
            <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: center;">Result</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      
      <div style="text-align: center; margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
        <p style="color: #9ca3af; font-size: 12px;">Generated on ${new Date().toLocaleDateString()} — Intellee College Assessment Platform</p>
      </div>
    </body>
    </html>
  `;
}
