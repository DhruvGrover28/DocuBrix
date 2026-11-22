from __future__ import annotations

import argparse
import csv
import json
import os
import pickle
import random
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, f1_score, precision_score, recall_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

SUPPORTED_LABELS: set[str] = {
    # Financial
    "invoice",
    "receipt",
    "bank_statement",
    "salary_slip",
    "other_financial_document",
    # Academic
    "academic_transcript",
    "academic_certificate",
    # Legal
    "legal_contract",
    "non_disclosure_agreement",
    # Medical
    "medical_prescription",
    "medical_lab_report",
    # Administrative
    "identity_document",
    "official_notice",
    # General
    "other_document",
}


def generate_synthetic_dataset(samples_per_class: int = 45) -> list[dict[str, str]]:
    """Generate a balanced, diverse synthetic dataset across all supported document classes."""
    data: list[dict[str, str]] = []
    rng = random.Random(42)

    # 1. INVOICE
    vendors = [
        "Acme Supplies Inc.", "Apex Cloud Technologies LLC", "Nexus Hardware Solutions",
        "Global Logistics Group", "Vortex Digital Agency", "Starlight Office Systems",
        "Pinnacle Software Labs", "Metro Industrial Supplies", "Quantum Server Hosting",
    ]
    clients = [
        "Wayne Enterprises", "Stark Industries", "Cyberdyne Corp", "Umbrella Pharmaceuticals",
        "Initech Software", "Massive Dynamic", "Hooli Inc.", "Acme Corp", "Globex Corporation",
    ]
    for i in range(samples_per_class):
        v = rng.choice(vendors)
        c = rng.choice(clients)
        inv_header = rng.choice(["TAX INVOICE", "INVOICE", "COMMERCIAL INVOICE", "BILL / INVOICE"])
        inv_label = rng.choice(["Invoice Number:", "Invoice No:", "Inv #", "Invoice #", "INV NO:"])
        inv_no = f"INV-{rng.randint(2024, 2026)}-{rng.randint(1001, 9999)}"
        amount = f"{rng.randint(250, 9500)}.{rng.choice(['00', '50', '75', '25'])}"
        tax = f"{float(amount) * 0.10:.2f}"
        total = f"{float(amount) * 1.10:.2f}"
        total_label = rng.choice(["Total Amount Due:", "Total Due:", "Balance Due:", "Total Amount:", "Grand Total:"])
        text = (
            f"{inv_header}\n"
            f"Vendor: {v}\n"
            f"124 Commercial Avenue, Suite {rng.randint(100, 900)}\n"
            f"Bill To: {c}\n"
            f"{inv_label} {inv_no}\n"
            f"Invoice Date: 2026-0{rng.randint(1, 9)}-{rng.randint(10, 28)}\n"
            f"Payment Terms: Net {rng.choice([15, 30, 45])} Days\n"
            f"Due Date: 2026-1{rng.randint(0, 2)}-{rng.randint(10, 28)}\n"
            f"Description | Qty | Unit Price | Total\n"
            f"Enterprise Service Subscription | 1 | ${amount} | ${amount}\n"
            f"Subtotal: ${amount}\n"
            f"Tax (10% GST/VAT): ${tax}\n"
            f"{total_label} ${total}\n"
            f"Remit payment to: Bank of America, Account ending 4821\n"
            f"Thank you for your business."
        )
        data.append({"text": text, "label": "invoice"})

    # 2. RECEIPT
    merchants = [
        "SuperMart Store #402", "Downtown Espresso Bar", "City Quick Pharmacy",
        "Green Valley Organic Market", "Metro Fuel Station & Mart", "Tech Gadget Store",
        "Blue Ocean Seafood Bistro", "Stationery Hub Express", "Corner Bakery & Deli",
    ]
    for i in range(samples_per_class):
        m = rng.choice(merchants)
        txn_id = f"TXN-{rng.randint(100000, 999999)}"
        item_cost = f"{rng.randint(5, 120)}.{rng.choice(['50', '99', '25', '00'])}"
        tax = f"{float(item_cost) * 0.08:.2f}"
        total = f"{float(item_cost) * 1.08:.2f}"
        card_end = rng.randint(1000, 9999)
        rcpt_header = rng.choice(["SALES RECEIPT", "RECEIPT", "PAYMENT RECEIPT", "CASH RECEIPT"])
        text = (
            f"{m}\n"
            f"{rcpt_header}\n"
            f"Terminal POS #{rng.randint(1, 12)} | Cashier: {rng.choice(['Alex', 'Jordan', 'Taylor', 'Sam', 'Chris'])}\n"
            f"Date: 2026-0{rng.randint(1, 9)}-{rng.randint(10, 28)} {rng.randint(10, 21)}:{rng.randint(10, 59)}\n"
            f"Sales Receipt / Txn ID: {txn_id}\n"
            f"--------------------------------\n"
            f"Items Purchased: Retail Goods\n"
            f"Subtotal: ${item_cost}\n"
            f"Sales Tax: ${tax}\n"
            f"Total Paid / Total: ${total}\n"
            f"Payment Method: {rng.choice(['Credit Card', 'Debit Card', 'Apple Pay', 'Cash Tendered'])}\n"
            f"Card ending in: {card_end}\n"
            f"Change returned: $0.00\n"
            f"Thank you for shopping with us! Please retain this receipt."
        )
        data.append({"text": text, "label": "receipt"})

    # 3. BANK STATEMENT
    banks = [
        "JPMorgan Chase Bank, N.A.", "Bank of America Merrill Lynch", "Wells Fargo Commercial",
        "Barclays Private Banking", "Citibank Global Services", "HDFC Bank Ltd.",
    ]
    for i in range(samples_per_class):
        b = rng.choice(banks)
        acc_no = f"XXXX-XXXX-{rng.randint(1000, 9999)}"
        open_bal = rng.randint(2500, 15000)
        close_bal = open_bal + rng.randint(-1200, 3500)
        stmt_header = rng.choice(["MONTHLY ACCOUNT STATEMENT", "BANK STATEMENT", "ACCOUNT STATEMENT"])
        acc_label = rng.choice(["Account Number:", "Account No:", "A/c No:"])
        text = (
            f"{b}\n"
            f"{stmt_header}\n"
            f"Account Name: {rng.choice(['Robert Langdon', 'Sarah Connor', 'Arthur Dent', 'Elena Fisher', 'Marcus Vance'])}\n"
            f"{acc_label} {acc_no}\n"
            f"Account Type: Business Checking Account\n"
            f"Statement Period: 2026-0{rng.randint(1, 8)}-01 to 2026-0{rng.randint(1, 8)}-28\n"
            f"Beginning Balance: ${open_bal:,.2f}\n"
            f"Total Deposits and Credits: ${rng.randint(1000, 8000):,.2f}\n"
            f"Total Withdrawals and Debits: ${rng.randint(500, 5000):,.2f}\n"
            f"Ending Balance / Closing Balance: ${close_bal:,.2f}\n"
            f"Transaction History:\n"
            f"2026-0{rng.randint(1, 8)}-05 | Direct Deposit Payroll | Credit | $3,500.00\n"
            f"2026-0{rng.randint(1, 8)}-14 | Utility Payment Auto-Debit | Debit | $185.40\n"
            f"Available Balance at period end: ${close_bal:,.2f}\n"
            f"IFSC / Routing Transit Code: {rng.randint(100000000, 999999999)}"
        )
        data.append({"text": text, "label": "bank_statement"})

    # 4. SALARY SLIP
    corps = [
        "Infosys Global Technologies", "Tata Consultancy Services", "Microsoft Corporation",
        "Google Cloud India Pvt Ltd", "Accenture Solutions", "Cognizant Technology Solutions",
    ]
    for i in range(samples_per_class):
        c = rng.choice(corps)
        emp_id = f"EMP-{rng.randint(10000, 99999)}"
        gross = rng.randint(4500, 12500)
        pf = int(gross * 0.08)
        tax = int(gross * 0.12)
        net = gross - pf - tax
        slip_header = rng.choice(["CONFIDENTIAL PAYSLIP", "SALARY SLIP", "PAY SLIP", "MONTHLY SALARY STATEMENT"])
        emp_label = rng.choice(["Employee Name:", "Name:", "Emp Name:"])
        id_label = rng.choice(["Employee ID:", "Emp ID:", "Employee Code:"])
        net_label = rng.choice(["Net Salary:", "Take Home Pay:", "Net Pay:"])
        text = (
            f"{c}\n"
            f"{slip_header}\n"
            f"Month of Pay: October 2026\n"
            f"{emp_label} {rng.choice(['Dhruv Grover', 'Priya Sharma', 'Amitabh Verma', 'Ananya Patel', 'Kavita Nair'])}\n"
            f"{id_label} {emp_id}\n"
            f"Designation: {rng.choice(['Senior Software Engineer', 'Solutions Architect', 'Data Scientist', 'Engineering Manager'])}\n"
            f"Department: Technology & Product\n"
            f"Basic Salary: ${int(gross * 0.5):,}.00\n"
            f"House Rent Allowance (HRA): ${int(gross * 0.3):,}.00\n"
            f"Special Allowances: ${int(gross * 0.2):,}.00\n"
            f"Gross Earnings / Gross Pay: ${gross:,.2f}\n"
            f"Provident Fund (PF) Deduction: ${pf:,.2f}\n"
            f"Tax Deducted at Source (TDS): ${tax:,.2f}\n"
            f"Total Deductions: ${pf + tax:,.2f}\n"
            f"{net_label} ${net:,.2f}\n"
            f"Disbursed via Direct Bank Transfer."
        )
        data.append({"text": text, "label": "salary_slip"})

    # 5. ACADEMIC TRANSCRIPT
    unis = [
        "Delhi Technological University", "National University of Singapore", "Stanford University",
        "University of California, Berkeley", "Indian Institute of Technology Delhi", "Imperial College London",
    ]
    for i in range(samples_per_class):
        u = rng.choice(unis)
        roll = f"2K2{rng.randint(0, 4)}/CO/{rng.randint(100, 499)}"
        cgpa = f"{rng.uniform(7.8, 9.8):.2f}"
        sem = rng.choice(["V", "VI", "VII", "VIII"])
        tr_header = rng.choice([
            "OFFICIAL TRANSCRIPT OF ACADEMIC RECORD",
            "TRANSCRIPT OF ACADEMIC RECORD",
            "OFFICIAL TRANSCRIPT",
            "MARKSHEET / GRADE CARD",
            "SEMESTER GRADE SHEET",
        ])
        stud_label = rng.choice(["Student Name:", "Student:", "Candidate Name:", "Name:"])
        roll_label = rng.choice(["Roll Number:", "Roll No:", "Enrollment No:", "Registration No:"])
        cgpa_label = rng.choice(["Cumulative GPA (CGPA):", "CGPA:", "Cumulative GPA:", "GPA:"])
        text = (
            f"{u.upper()}\n"
            f"{tr_header}\n"
            f"{stud_label} {rng.choice(['Pranav Bisht', 'Aarav Gupta', 'Rohan Mehra', 'Sneha Kapoor', 'Meera Rao'])}\n"
            f"{roll_label} {roll}\n"
            f"Degree: Bachelor of Technology (B.Tech) in Computer Science\n"
            f"Semester: Semester {sem} Examination 2026\n"
            f"Course Code | Course Title | Credits | Grade Point | Letter Grade\n"
            f"CS-401 | Distributed Systems | 4.0 | 9.0 | A+\n"
            f"CS-403 | Machine Learning & NLP | 4.0 | 10.0 | O\n"
            f"CS-405 | Computer Vision & OCR | 3.0 | 9.0 | A+\n"
            f"CS-407 | Cloud Architecture | 3.0 | 8.0 | A\n"
            f"Credits Registered: 24 | Credits Earned: 24\n"
            f"Semester GPA (SGPA): {float(cgpa) + rng.uniform(-0.2, 0.2):.2f}\n"
            f"{cgpa_label} {cgpa} / 10.00\n"
            f"Result: First Class with Distinction\n"
            f"Office of the Controller of Examinations."
        )
        data.append({"text": text, "label": "academic_transcript"})

    # 6. ACADEMIC CERTIFICATE
    for i in range(samples_per_class):
        u = rng.choice(unis)
        degree = rng.choice([
            "Bachelor of Technology in Computer Engineering",
            "Master of Science in Artificial Intelligence",
            "Doctor of Philosophy in Computer Science",
            "Bachelor of Science in Data Analytics",
        ])
        cert_header = rng.choice(["DEGREE CERTIFICATE", "CERTIFICATE OF GRADUATION", "DIPLOMA CERTIFICATE"])
        text = (
            f"{u.upper()}\n"
            f"{cert_header}\n"
            f"The Chancellor, Vice Chancellor and Members of the Academic Council\n"
            f"Hereby certify that the degree of\n"
            f"{degree}\n"
            f"has been conferred upon\n"
            f"{rng.choice(['Pranav Bisht', 'Siddharth Iyer', 'Natasha Romanoff', 'Diana Prince', 'Devendra Singh'])}\n"
            f"having fulfilled all academic requirements and passed the prescribed examinations\n"
            f"with First Class Honours.\n"
            f"Given under the seal of the University this day: 2026-06-15\n"
            f"Dean of Academic Affairs | Chancellor | Registrar"
        )
        data.append({"text": text, "label": "academic_certificate"})

    # 7. LEGAL CONTRACT
    for i in range(samples_per_class):
        p1 = rng.choice(["Acme Global Holdings Ltd.", "Omni Consumer Products Corp.", "Stark Enterprises LLC"])
        p2 = rng.choice(["Beta Consulting Services Inc.", "Cyberdyne Systems Corp.", "Wayne Analytics Ltd."])
        contract_type = rng.choice([
            "MASTER SERVICES AGREEMENT", "CONSULTING SERVICES AGREEMENT",
            "INDEPENDENT CONTRACTOR AGREEMENT", "COMMERCIAL LEASE AGREEMENT",
        ])
        text = (
            f"{contract_type}\n"
            f"This Agreement is entered into on this {rng.randint(1, 28)}th day of May, 2026, by and between:\n"
            f"Party of the First Part: {p1} ('Client')\n"
            f"and\n"
            f"Party of the Second Part: {p2} ('Contractor').\n"
            f"WHEREAS, the Client desires to retain Contractor for technical services, and Contractor agrees to provide such services.\n"
            f"TERMS AND CONDITIONS:\n"
            f"1. Scope of Work: Contractor shall perform the milestones detailed in Exhibit A.\n"
            f"2. Term and Termination: This contract shall remain in effect for 24 months unless terminated early under Section 8.\n"
            f"3. Warranties and Representations: Contractor warrants professional standard of work.\n"
            f"4. Indemnification & Limitation of Liability: Neither party shall be liable for consequential damages.\n"
            f"5. Governing Law and Jurisdiction: This Agreement shall be governed by the laws of India, courts of Delhi.\n"
            f"IN WITNESS WHEREOF, the authorized representatives have executed this Agreement."
        )
        data.append({"text": text, "label": "legal_contract"})

    # 8. NON DISCLOSURE AGREEMENT
    for i in range(samples_per_class):
        p1 = rng.choice(["Alpha Dynamics Corp", "Quantum Software Inc", "Horizon Venture Labs"])
        p2 = rng.choice(["Pinnacle Technologies LLC", "Vanguard AI Solutions", "Apex Global Media"])
        nda_header = rng.choice(["MUTUAL NON-DISCLOSURE AGREEMENT (NDA)", "NON-DISCLOSURE AGREEMENT", "CONFIDENTIALITY AGREEMENT"])
        text = (
            f"{nda_header}\n"
            f"This Confidentiality Agreement is entered into by and between {p1} ('Disclosing Party')\n"
            f"and {p2} ('Receiving Party') as of Effective Date: 2026-04-12.\n"
            f"1. Definition of Confidential Information: Proprietary technology, algorithms, source code, trade secrets, financial records.\n"
            f"2. Obligations of Receiving Party: The Recipient agrees to hold all Proprietary Information in strict confidence and shall not disclose it to any third party.\n"
            f"3. Exclusions from Confidentiality: Information publicly known through no breach of this agreement.\n"
            f"4. Standard of Care: Receiving party shall exercise no less than reasonable degree of care.\n"
            f"5. Term: Obligation of confidentiality shall survive for a period of 5 years from disclosure.\n"
            f"6. Governing Law: This NDA shall be construed under the laws of the State of New York.\n"
            f"Executed by the duly authorized signatories of both parties."
        )
        data.append({"text": text, "label": "non_disclosure_agreement"})

    # 9. MEDICAL PRESCRIPTION
    hospitals = [
        "Apollo Clinical Healthcare", "Max Super Speciality Hospital", "Fortis Healthcare Clinic",
        "St. Jude Medical Centre", "City Community Health Hospital",
    ]
    for i in range(samples_per_class):
        h = rng.choice(hospitals)
        dr = rng.choice(["Dr. Arvind Sharma, MD", "Dr. Shalini Mukerji, MBBS, MD", "Dr. Robert Chen, MD", "Dr. Preeti Deshmukh, MS"])
        patient = rng.choice(["John Doe", "Anita Kumar", "Michael Scott", "Deepak Verma", "Grace Hopper"])
        age = rng.randint(22, 68)
        sex = rng.choice(["Male", "Female"])
        rx_header = rng.choice(["OUTPATIENT CLINICAL PRESCRIPTION", "MEDICAL PRESCRIPTION", "CLINICAL PRESCRIPTION"])
        pat_label = rng.choice(["Patient Name:", "Patient:", "Name:"])
        text = (
            f"{h.upper()}\n"
            f"{rx_header}\n"
            f"Consultant: {dr}\n"
            f"Registration No: MCI-{rng.randint(10000, 99999)}\n"
            f"{pat_label} {patient} | Age/Sex: {age} Yrs / {sex}\n"
            f"Consultation Date: 2026-11-10\n"
            f"Chief Complaints: Fever, persistent dry cough, mild headache x 3 days\n"
            f"Vitals: BP 120/80 mmHg, Pulse 76 bpm, Temp 99.4 F\n"
            f"Rx:\n"
            f"1. Tab. Paracetamol 650mg - 1 tablet three times daily after meals x 5 days\n"
            f"2. Tab. Azithromycin 500mg - 1 tablet once daily before meals x 3 days\n"
            f"3. Syrup CoughRelief 10ml - twice daily after food at bedtime x 5 days\n"
            f"Advice: Drink plenty of warm water. Review after 5 days if symptoms persist.\n"
            f"Doctor Signature & Hospital Stamp"
        )
        data.append({"text": text, "label": "medical_prescription"})

    # 10. MEDICAL LAB REPORT
    labs = [
        "Quest Diagnostics Pathology", "Metropolis Diagnostic Laboratories",
        "PathKind Diagnostic Services", "Dr. Lal PathLabs Clinical Laboratory",
    ]
    for i in range(samples_per_class):
        lab = rng.choice(labs)
        patient = rng.choice(["Jane Doe", "Rahul Dravid", "Carlos Sainz", "Sunita Williams", "Karan Malhotra"])
        test = rng.choice([
            ("Complete Blood Count (CBC)", "Haemoglobin", "14.2", "g/dL", "13.0 - 17.0"),
            ("Comprehensive Metabolic Panel", "Fasting Blood Glucose", "92.0", "mg/dL", "70.0 - 99.0"),
            ("Lipid Profile Panel", "Total Serum Cholesterol", "185.0", "mg/dL", "125.0 - 200.0"),
            ("Thyroid Function Test", "Serum TSH", "2.45", "uIU/mL", "0.50 - 4.50"),
        ])
        lab_header = rng.choice(["LABORATORY INVESTIGATION REPORT", "DIAGNOSTIC REPORT", "PATHOLOGY REPORT"])
        text = (
            f"{lab.upper()}\n"
            f"{lab_header}\n"
            f"Patient Name: {patient} | Age/Gender: {rng.randint(20, 65)} Yrs / {rng.choice(['Male', 'Female'])}\n"
            f"Specimen Type: Whole Blood / Serum | Collection Date: 2026-10-18\n"
            f"Department: Clinical Biochemistry & Pathology\n"
            f"Investigation / Test Name: {test[0]}\n"
            f"Parameter | Observed Value | Unit | Biological Reference Interval\n"
            f"{test[1]} | {test[2]} | {test[3]} | {test[4]}\n"
            f"Clinical Notes: Specimen examined and verified within normal reference range.\n"
            f"Consultant Pathologist: Dr. N. Sengupta, MD (Pathology)"
        )
        data.append({"text": text, "label": "medical_lab_report"})

    # 11. IDENTITY DOCUMENT
    for i in range(samples_per_class):
        id_type = rng.choice(["PASSPORT", "DRIVING LICENCE", "NATIONAL IDENTITY CARD", "VOTER ID CARD"])
        name = rng.choice(["PRANAV BISHT", "BRUCE WAYNE", "TONY STARK", "PETER PARKER", "SARAH CONNOR", "CLARK KENT"])
        id_no = f"{rng.choice(['P', 'DL', 'ID', 'VT'])}{rng.randint(10000000, 99999999)}"
        dob = f"{rng.randint(1980, 2003)}-{rng.randint(1, 12):02d}-{rng.randint(1, 28):02d}"
        text = (
            f"GOVERNMENT ISSUED OFFICIAL {id_type}\n"
            f"Document Number: {id_no}\n"
            f"Cardholder Full Name: {name}\n"
            f"Date of Birth (DOB): {dob}\n"
            f"Gender: {rng.choice(['MALE', 'FEMALE'])}\n"
            f"Nationality: {rng.choice(['INDIAN', 'AMERICAN', 'BRITISH', 'CANADIAN'])}\n"
            f"Place of Birth: {rng.choice(['NEW DELHI', 'NEW YORK', 'LONDON', 'SAN FRANCISCO'])}\n"
            f"Issuing Authority: Government Ministry of External Affairs / Department of Motor Vehicles\n"
            f"Date of Issue: 2022-03-15\n"
            f"Expiry Date / Valid Until: 2032-03-14"
        )
        data.append({"text": text, "label": "identity_document"})

    # 12. OFFICIAL NOTICE
    orgs = [
        "Ministry of Personnel & Public Grievances", "Office of the Registrar, Central University",
        "Municipal Corporation Administrative Secretariat", "Department of Higher Education",
    ]
    for i in range(samples_per_class):
        org = rng.choice(orgs)
        ref_no = f"ADM/NOT/{rng.randint(2024, 2026)}/{rng.randint(100, 999)}"
        notice_header = rng.choice(["OFFICE MEMORANDUM / OFFICIAL NOTICE", "OFFICIAL NOTICE", "ADMINISTRATIVE CIRCULAR"])
        text = (
            f"{org.upper()}\n"
            f"{notice_header}\n"
            f"Reference No: {ref_no}\n"
            f"Date: 2026-09-0{rng.randint(1, 9)}\n"
            f"Subject: Administrative Circular regarding revised office hours and holiday schedule.\n"
            f"To: All Heads of Departments, Faculty, and Staff Members\n"
            f"In accordance with the order of the Competent Authority, it is hereby notified that "
            f"all departmental units shall comply with the updated operational guidelines.\n"
            f"This administrative order comes into force with immediate effect.\n"
            f"By Order of the Competent Authority\n"
            f"Joint Secretary / Registrar"
        )
        data.append({"text": text, "label": "official_notice"})

    # 13. OTHER DOCUMENT (General - Resumes, Cover Letters, General correspondence)
    for i in range(samples_per_class):
        candidate = rng.choice(["Pranav Bisht", "Alex Morgan", "Elena Rostova", "Marcus Chen", "Pooja Hegde"])
        role = rng.choice([
            "Senior Full Stack Software Engineer",
            "Machine Learning Engineer & Data Scientist",
            "DevOps & Cloud Infrastructure Architect",
            "Product Designer & UI/UX Specialist",
        ])
        sub_type = rng.choice(["resume", "cover_letter", "memo"])
        if sub_type == "resume":
            text = (
                f"{candidate}\n"
                f"Email: {candidate.lower().replace(' ', '.')}@example.com | Phone: +1-555-0192 | GitHub: github.com/candidate\n"
                f"LinkedIn: linkedin.com/in/{candidate.lower().replace(' ', '')}\n\n"
                f"PROFESSIONAL SUMMARY\n"
                f"Dynamic {role} with experience designing scalable microservices, "
                f"modern web applications with React and FastAPI, and optimizing database pipelines.\n\n"
                f"TECHNICAL SKILLS\n"
                f"Languages: Python, JavaScript, TypeScript, Go, SQL\n"
                f"Frameworks: FastAPI, React, Node.js, TailwindCSS, PyTorch\n"
                f"Databases & Tools: PostgreSQL, SQLite, Docker, Kubernetes, Git, CI/CD\n\n"
                f"WORK EXPERIENCE\n"
                f"{role} — Tech Innovations Corp (2023 - Present)\n"
                f"• Architected automated document ingestion system serving 100k daily requests.\n"
                f"• Spearheaded migration from legacy monolith to cloud-native microservices.\n\n"
                f"EDUCATION\n"
                f"Bachelor of Technology in Computer Science, GPA: 3.9/4.0 (2019 - 2023)\n"
                f"PROJECTS & CERTIFICATIONS\n"
                f"DocuBrix: Intelligent document processing with multi-domain OCR and workflow rules."
            )
        elif sub_type == "cover_letter":
            text = (
                f"{candidate}\n"
                f"Date: November 15, 2026\n"
                f"Hiring Manager\n"
                f"Innovative Tech Solutions\n\n"
                f"Dear Hiring Team,\n\n"
                f"I am writing to express my strong enthusiasm for the {role} position at your organization. "
                f"With a strong background in software engineering, distributed systems, and modern AI development, "
                f"I am eager to contribute to your team's mission.\n\n"
                f"Throughout my professional journey, I have built reliable web applications, improved API response times "
                f"by 40%, and collaborated closely with cross-functional product teams. I look forward to the opportunity "
                f"to discuss how my qualifications align with your engineering goals.\n\n"
                f"Thank you for your time and consideration.\n\n"
                f"Sincerely,\n"
                f"{candidate}"
            )
        else:
            text = (
                f"INTERNAL DISCUSSION MEMO\n"
                f"Date: 2026-10-22\n"
                f"Author: {candidate}\n"
                f"Topic: Engineering sprint retrospective and team knowledge sharing.\n\n"
                f"Hi team, below is a quick summary of our recent sprint discussion:\n"
                f"- Completed refactoring of frontend card layouts and responsive components.\n"
                f"- Improved unit test reliability and continuous integration execution times.\n"
                f"- Scheduled upcoming architecture workshop for end-to-end integration.\n"
                f"Please add your feedback to the team wiki by Friday."
            )
        data.append({"text": text, "label": "other_document"})

    # 14. OTHER FINANCIAL DOCUMENT (Earnings reports, board budget summaries)
    for i in range(samples_per_class):
        corp = rng.choice(["Acme Global Holdings", "Titan Industrial Technologies", "Vertex Semiconductor Corp"])
        quarter = rng.choice(["Q1", "Q2", "Q3", "Q4"])
        year = rng.choice(["2025", "2026"])
        rev = rng.randint(45, 180)
        margin = rng.randint(18, 38)
        text = (
            f"{corp.upper()} — {quarter} {year} FINANCIAL RESULTS & EARNINGS REPORT\n"
            f"BOARD OF DIRECTORS EXECUTIVE SUMMARY\n"
            f"Consolidated Financial Highlights for Fiscal Period {quarter} {year}:\n"
            f"• Total Net Revenue: ${rev} Million, representing a 14% year-over-year increase.\n"
            f"• Operating Income: ${int(rev * 0.28)} Million with an Operating Margin of {margin}%.\n"
            f"• Diluted Earnings Per Share (EPS): ${rng.uniform(1.2, 4.5):.2f}.\n"
            f"• Cash Flow from Operations: ${int(rev * 0.32)} Million.\n"
            f"Balance Sheet Overview: Cash reserves remained strong at ${int(rev * 0.55)} Million.\n"
            f"Capital Expenditures were directed toward cloud infrastructure and data center expansion.\n"
            f"Investor Relations Contact: investor-relations@{corp.lower().replace(' ', '')}.com"
        )
        data.append({"text": text, "label": "other_financial_document"})

    rng.shuffle(data)
    return data


def save_synthetic_dataset(output_path: Path, samples_per_class: int = 45) -> list[dict[str, str]]:
    dataset = generate_synthetic_dataset(samples_per_class=samples_per_class)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["text", "label"])
        writer.writeheader()
        for row in dataset:
            writer.writerow(row)
    return dataset


def read_rows(path: Path) -> tuple[list[str], list[str]]:
    texts: list[str] = []
    labels: list[str] = []
    if not path.exists():
        raise FileNotFoundError(f"Dataset file not found: {path}")
    with path.open("r", encoding="utf-8", newline="") as source:
        if path.suffix.lower() == ".csv":
            rows = csv.DictReader(source)
        else:
            rows = (json.loads(line) for line in source if line.strip())
        for row in rows:
            text = str(row.get("text") or row.get("raw_text") or "").strip()
            label = str(row.get("label") or row.get("document_type") or "").strip().lower()
            if text and label in SUPPORTED_LABELS:
                texts.append(text)
                labels.append(label)
    if len(set(labels)) < 2:
        raise ValueError("The labeled dataset must contain at least two supported classes.")
    return texts, labels


def train_and_evaluate(
    dataset_path: Path,
    output_path: Path,
    model_version: str = "1.0.0",
    test_size: float = 0.2,
    random_state: int = 42,
) -> dict[str, Any]:
    texts, labels = read_rows(dataset_path)
    counts = Counter(labels)
    can_stratify = all(count >= 2 for count in counts.values()) and len(texts) >= 5

    train_texts, test_texts, train_labels, test_labels = train_test_split(
        texts,
        labels,
        test_size=test_size,
        random_state=random_state,
        stratify=labels if can_stratify else None,
    )
    pipeline = Pipeline(
        [
            (
                "tfidf",
                TfidfVectorizer(
                    lowercase=True,
                    ngram_range=(1, 2),
                    min_df=1,
                    max_df=0.98,
                    sublinear_tf=True,
                    strip_accents="unicode",
                ),
            ),
            (
                "classifier",
                LogisticRegression(
                    max_iter=1000,
                    class_weight="balanced",
                    random_state=random_state,
                    C=5.0,
                    solver="lbfgs",
                ),
            ),
        ]
    )
    pipeline.fit(train_texts, train_labels)
    predictions = pipeline.predict(test_texts)
    metrics = {
        "accuracy": round(float(accuracy_score(test_labels, predictions)), 4),
        "precision_macro": round(float(precision_score(test_labels, predictions, average="macro", zero_division=0)), 4),
        "recall_macro": round(float(recall_score(test_labels, predictions, average="macro", zero_division=0)), 4),
        "f1_macro": round(float(f1_score(test_labels, predictions, average="macro", zero_division=0)), 4),
        "train_size": len(train_labels),
        "test_size": len(test_labels),
        "class_distribution": dict(counts),
        "classification_report": classification_report(test_labels, predictions, zero_division=0, output_dict=True),
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("wb") as output:
        pickle.dump(
            {
                "vectorizer": pipeline.named_steps["tfidf"],
                "classifier": pipeline.named_steps["classifier"],
                "model_name": "tfidf-logistic-regression",
                "model_version": model_version,
                "metrics": metrics,
                "labels": sorted(set(labels)),
                "trained_at": datetime.now(timezone.utc).isoformat(),
            },
            output,
        )
    return metrics


def main() -> None:
    parser = argparse.ArgumentParser(description="Train and evaluate the DocuBrix multi-class document classifier.")
    parser.add_argument(
        "dataset",
        type=Path,
        nargs="?",
        default=None,
        help="Optional CSV or JSONL file with text and label columns. If omitted, a balanced synthetic dataset is generated.",
    )
    parser.add_argument(
        "--output",
        "-o",
        type=Path,
        default=Path("backend/models/document_classifier.pkl"),
        help="Output classifier artifact path (default: backend/models/document_classifier.pkl)",
    )
    parser.add_argument(
        "--dataset-out",
        type=Path,
        default=Path("backend/data/training_dataset.csv"),
        help="Output path for generated synthetic dataset if no dataset is provided.",
    )
    parser.add_argument("--samples-per-class", type=int, default=45, help="Number of synthetic samples per class (default: 45)")
    parser.add_argument("--model-version", type=str, default="1.0.0", help="Model version identifier")
    parser.add_argument("--test-size", type=float, default=0.2, help="Fraction of data reserved for test set")
    args = parser.parse_args()

    dataset_path = args.dataset
    if dataset_path is None or not dataset_path.exists():
        dataset_path = args.dataset_out
        print(f"Generating balanced synthetic dataset ({args.samples_per_class} samples/class) at {dataset_path}...")
        save_synthetic_dataset(dataset_path, samples_per_class=args.samples_per_class)

    print(f"Training multi-class model from {dataset_path} -> {args.output}...")
    metrics = train_and_evaluate(
        dataset_path=dataset_path,
        output_path=args.output,
        model_version=args.model_version,
        test_size=args.test_size,
    )
    print("Training completed successfully!")
    print(json.dumps(metrics, indent=2, default=str))


if __name__ == "__main__":
    main()
