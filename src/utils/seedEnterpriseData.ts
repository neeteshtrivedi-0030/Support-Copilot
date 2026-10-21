import mongoose, { Types } from 'mongoose';
import { env } from '../config/env';
import { KnowledgeDocument, DocumentChunk, User } from '../models';
import {
  Department,
  DocumentAccessLevel,
  DocumentFileType,
  DocumentProcessingStatus,
  UserRole,
} from '../enum';

interface DocumentSeed {
  name: string;
  type: DocumentFileType;
  department: Department;
  accessLevel: DocumentAccessLevel;
  filePath: string;
  chunks: Array<{
    section: string;
    pageNumber: number;
    content: string;
  }>;
}

const enterpriseDocuments: DocumentSeed[] = [
  {
    name: 'Company Work-From-Home and Hybrid Policy 2026',
    type: DocumentFileType.PDF,
    department: Department.HR,
    accessLevel: DocumentAccessLevel.PUBLIC,
    filePath: 'documents/HR/company-wfh-hybrid-policy-2026.pdf',
    chunks: [
      {
        section: 'Eligibility and Hybrid Schedule',
        pageNumber: 1,
        content:
          'All full-time employees who have successfully completed their 90-day probationary period are eligible for hybrid remote work. Employees may work remotely up to 3 days per week with prior manager approval. Core collaboration hours are 10:00 AM to 4:00 PM local time, during which employees must be available on Slack and email.',
      },
      {
        section: 'Home Office Equipment & Stipend',
        pageNumber: 2,
        content:
          'The company provides all eligible remote employees with a standard corporate laptop, external monitor, and a one-time home office setup stipend of up to $500 for ergonomic furniture, desk accessories, and monitors. Expense reimbursement receipts must be submitted via the finance portal within 60 days of hire.',
      },
      {
        section: 'Remote Security Requirements',
        pageNumber: 3,
        content:
          'Employees working remotely must connect through the corporate GlobalProtect VPN whenever accessing company networks or handling confidential customer data. Multi-Factor Authentication (MFA) is strictly required for all internal portals. Working from unsecured public Wi-Fi without VPN is prohibited.',
      },
    ],
  },
  {
    name: 'IT Hardware and Laptop Replacement Policy',
    type: DocumentFileType.DOCX,
    department: Department.IT,
    accessLevel: DocumentAccessLevel.PUBLIC,
    filePath: 'documents/IT/it-hardware-laptop-replacement-policy.docx',
    chunks: [
      {
        section: 'Hardware Lifecycle & Refresh Cadence',
        pageNumber: 1,
        content:
          'Standard employee laptops are scheduled for mandatory replacement every 36 months (3 years) from initial provisioning date. IT Asset Management will automatically notify employees 30 days prior to their eligible refresh cycle to coordinate backup and delivery of the replacement device.',
      },
      {
        section: 'Eligible Machine Tiers',
        pageNumber: 2,
        content:
          'Engineering and Data Science team members receive 16-inch Apple MacBook Pro (M3 Pro chip, 36GB unified memory) or Lenovo ThinkPad P16 workstations. Non-engineering employees receive 14-inch Apple MacBook Air (M3 chip, 16GB RAM) or Lenovo ThinkPad T14s. Custom hardware configurations require Department VP approval.',
      },
      {
        section: 'Hardware Repair and Loss Reporting',
        pageNumber: 3,
        content:
          'In the event of accidental hardware damage or malfunction, submit an urgent ticket to the IT Helpdesk under "Hardware Repair". If a device is lost or stolen, report immediately within 2 hours to security@supportcopilot.com and the IT Helpdesk so that remote device lock and cryptographic wipe can be executed.',
      },
    ],
  },
  {
    name: 'Corporate Travel and Expense Reimbursement Manual',
    type: DocumentFileType.PDF,
    department: Department.FINANCE,
    accessLevel: DocumentAccessLevel.PUBLIC,
    filePath: 'documents/Finance/travel-expense-reimbursement-manual.pdf',
    chunks: [
      {
        section: 'Submission Timeline and Receipts',
        pageNumber: 1,
        content:
          'All business-related expenses must be submitted within 30 calendar days of expense date via the ERP Expense Portal. Original digital or photographed itemized receipts are required for all individual expenses exceeding $25. Credit card summary slips without itemized line items are not accepted.',
      },
      {
        section: 'Daily Meal Per Diem and Travel Allowances',
        pageNumber: 2,
        content:
          'Daily meal reimbursement per diem is capped at $75 per day during authorized corporate travel ($15 breakfast, $25 lunch, $35 dinner). Alcohol is strictly non-reimbursable unless incurred during pre-approved client entertainment dinners with VP authorization.',
      },
      {
        section: 'Approval Workflow and Direct Deposit',
        pageNumber: 3,
        content:
          'Expense reports under $1,000 require approval by the direct team manager. Reports exceeding $1,000 require Department Head and Finance Director approval. Approved reimbursements are paid out via direct deposit within 3-5 business days following final audit approval.',
      },
    ],
  },
  {
    name: 'Information Security and Data Protection Guidelines',
    type: DocumentFileType.PDF,
    department: Department.SECURITY,
    accessLevel: DocumentAccessLevel.PUBLIC,
    filePath: 'documents/Security/infosec-data-protection-guidelines.pdf',
    chunks: [
      {
        section: 'Password Hygiene & Multi-Factor Authentication',
        pageNumber: 1,
        content:
          'All employee passwords must be at least 14 characters long and include numbers, uppercase letters, and special symbols. Enterprise 1Password vault accounts are provided to all staff. Passwords must not be shared or stored in plaintext. Multi-Factor Authentication (MFA) via Okta Verify or YubiKey is mandatory.',
      },
      {
        section: 'Phishing Awareness and Incident Reporting',
        pageNumber: 2,
        content:
          'Never click links or open attachments in unsolicited or suspicious emails. If you receive a suspected phishing attempt, click the "Report Phishing" button in Microsoft Outlook or forward the raw email headers to security@supportcopilot.com. The Infosec Incident Response team is available 24/7.',
      },
    ],
  },
];

export async function seedEnterpriseData(): Promise<void> {
  const adminUser = await User.findOne({ role: UserRole.ADMIN }).exec();
  const uploaderId = adminUser ? adminUser._id : new Types.ObjectId();

  for (const docSeed of enterpriseDocuments) {
    let doc = await KnowledgeDocument.findOne({ name: docSeed.name }).exec();

    if (!doc) {
      doc = await KnowledgeDocument.create({
        name: docSeed.name,
        type: docSeed.type,
        department: docSeed.department,
        accessLevel: docSeed.accessLevel,
        status: DocumentProcessingStatus.PROCESSED,
        fileHash: `seed-${docSeed.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        fileSize: 1024 * (docSeed.chunks.length * 15),
        filePath: docSeed.filePath,
        chunkCount: docSeed.chunks.length,
        uploadedBy: uploaderId,
        metadata: {
          originalFileName: `${docSeed.name}.${docSeed.type}`,
          mimeType:
            docSeed.type === DocumentFileType.PDF
              ? 'application/pdf'
              : docSeed.type === DocumentFileType.DOCX
                ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                : 'text/plain',
          isSystemSeeded: true,
        },
      });
    } else {
      doc.status = DocumentProcessingStatus.PROCESSED;
      doc.chunkCount = docSeed.chunks.length;
      await doc.save();
    }

    // Upsert chunks
    for (let i = 0; i < docSeed.chunks.length; i++) {
      const chunkData = docSeed.chunks[i];
      await DocumentChunk.findOneAndUpdate(
        { documentId: doc._id, chunkIndex: i },
        {
          documentId: doc._id,
          chunkIndex: i,
          content: chunkData.content,
          pageNumber: chunkData.pageNumber,
          section: chunkData.section,
          tokenCount: Math.ceil(chunkData.content.length / 4),
          department: docSeed.department,
          accessLevel: docSeed.accessLevel,
          documentName: docSeed.name,
          metadata: {
            source: 'system_seed',
          },
        },
        { upsert: true, new: true }
      );
    }
  }

  // Also process any existing pending documents
  const pendingDocs = await KnowledgeDocument.find({
    status: DocumentProcessingStatus.PENDING,
  }).exec();
  for (const pDoc of pendingDocs) {
    const existingChunks = await DocumentChunk.countDocuments({ documentId: pDoc._id });
    if (existingChunks === 0) {
      const generatedSnippet = `Document: ${pDoc.name}. Department: ${pDoc.department}. Original File: ${pDoc.metadata?.originalFileName || pDoc.name}. This document contains organizational technical and application specifications for ${pDoc.name}.`;
      await DocumentChunk.create({
        documentId: pDoc._id,
        chunkIndex: 0,
        content: generatedSnippet,
        pageNumber: 1,
        section: 'Overview & Technical Details',
        tokenCount: Math.ceil(generatedSnippet.length / 4),
        department: pDoc.department,
        accessLevel: pDoc.accessLevel,
        documentName: pDoc.name,
      });
      pDoc.chunkCount = 1;
    }
    pDoc.status = DocumentProcessingStatus.PROCESSED;
    await pDoc.save();
  }

  console.log('[Seed] Enterprise documents & chunks seeded successfully.');
}

if (require.main === module) {
  mongoose
    .connect(env.MONGODB_URI)
    .then(async () => {
      console.log('[Seed] Connected to MongoDB');
      await seedEnterpriseData();
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed] Error:', err);
      process.exit(1);
    });
}
