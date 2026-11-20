from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

# Default system workflow rules
DEFAULT_WORKFLOW_RULES: list[dict[str, Any]] = [
    {
        "id": "rule-auto-approval",
        "name": "High-Confidence Auto-Approval",
        "description": "Automatically approve documents when confidence exceeds 85% and validation passes cleanly.",
        "rule_type": "auto_approval",
        "enabled": True,
        "conditions": {
            "min_confidence": 0.85,
            "require_valid": True,
        },
        "action": {
            "target_status": "approved",
            "tag": "auto_approved",
            "notification": "Document meets quality standards and was automatically approved.",
        },
    },
    {
        "id": "rule-confidence-gate",
        "name": "Low-Confidence Review Gate",
        "description": "Route documents with confidence below 70% to the human review queue.",
        "rule_type": "confidence_gate",
        "enabled": True,
        "conditions": {
            "max_confidence": 0.70,
        },
        "action": {
            "target_status": "needs_review",
            "tag": "requires_human_verification",
            "notification": "Low confidence score detected. Manual verification recommended.",
        },
    },
    {
        "id": "rule-high-value-invoice",
        "name": "High-Value Invoice Spend Gate",
        "description": "Flag invoices exceeding $1,000 for secondary financial supervisor sign-off.",
        "rule_type": "alert_trigger",
        "enabled": True,
        "conditions": {
            "document_type": "invoice",
            "min_amount": 1000.0,
        },
        "action": {
            "target_status": "pending_approval",
            "tag": "high_value_spend",
            "notification": "Invoice exceeds $1,000 threshold. Supervisor sign-off required.",
        },
    },
    {
        "id": "rule-academic-verification",
        "name": "Academic Transcript & Degree Verification",
        "description": "Route academic transcripts and certificates to the Registrar / HR verification queue.",
        "rule_type": "routing_tag",
        "enabled": True,
        "conditions": {
            "categories": ["Academic"],
        },
        "action": {
            "target_status": "verified",
            "tag": "academic_credentials_verified",
            "notification": "Academic document routed to education credentials pipeline.",
        },
    },
    {
        "id": "rule-legal-compliance",
        "name": "Contract & NDA Compliance Check",
        "description": "Inspect legal contracts for governing law and term clauses, tagging for compliance audit.",
        "rule_type": "alert_trigger",
        "enabled": True,
        "conditions": {
            "categories": ["Legal"],
        },
        "action": {
            "target_status": "in_compliance_review",
            "tag": "legal_audit",
            "notification": "Legal contract queued for compliance and indemnification audit.",
        },
    },
    {
        "id": "rule-medical-phi",
        "name": "Medical Confidentiality & HIPAA/PHI Shield",
        "description": "Tag prescriptions and lab reports as sensitive health records and enforce restricted access.",
        "rule_type": "routing_tag",
        "enabled": True,
        "conditions": {
            "categories": ["Medical"],
        },
        "action": {
            "target_status": "secure_archived",
            "tag": "phi_confidential",
            "notification": "Protected health information detected. Encrypted storage applied.",
        },
    },
]

# In-memory execution logs and live rule storage
_ACTIVE_RULES: list[dict[str, Any]] = [dict(r) for r in DEFAULT_WORKFLOW_RULES]
_EXECUTION_LOGS: list[dict[str, Any]] = []


def get_workflow_rules() -> list[dict[str, Any]]:
    return list(_ACTIVE_RULES)


def add_workflow_rule(rule_data: dict[str, Any]) -> dict[str, Any]:
    new_rule = {
        "id": f"rule-{uuid.uuid4().hex[:8]}",
        "name": rule_data.get("name", "Custom Workflow Rule"),
        "description": rule_data.get("description", ""),
        "rule_type": rule_data.get("rule_type", "routing_tag"),
        "enabled": True,
        "conditions": rule_data.get("conditions", {}),
        "action": rule_data.get("action", {
            "target_status": "processed",
            "tag": "custom_rule_triggered",
            "notification": "Custom rule applied.",
        }),
    }
    _ACTIVE_RULES.append(new_rule)
    return new_rule


def update_workflow_rule(rule_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
    for rule in _ACTIVE_RULES:
        if rule["id"] == rule_id:
            rule.update(updates)
            return rule
    return None


def delete_workflow_rule(rule_id: str) -> bool:
    global _ACTIVE_RULES
    initial_len = len(_ACTIVE_RULES)
    _ACTIVE_RULES = [r for r in _ACTIVE_RULES if r["id"] != rule_id]
    return len(_ACTIVE_RULES) < initial_len


def get_workflow_logs(limit: int = 50, owner_id: str | None = None) -> list[dict[str, Any]]:
    logs = _EXECUTION_LOGS
    if owner_id:
        logs = [l for l in logs if l.get("owner_id") == owner_id]
    return sorted(logs, key=lambda x: x["timestamp"], reverse=True)[:limit]


def evaluate_document_workflows(document: dict[str, Any]) -> dict[str, Any]:
    doc_id = document.get("document_id") or document.get("id") or str(uuid.uuid4())
    owner_id = document.get("owner_id")
    filename = document.get("filename", "Unknown Document")
    doc_type = document.get("document_type", "unknown")
    category = document.get("category") or (document.get("extracted_fields") or {}).get("category", "General")
    confidence_data = document.get("confidence") or document.get("confidence_scores") or {}
    overall_conf = float(confidence_data.get("overall", 0.75))
    validation = document.get("validation") or (document.get("extracted_json") or {}).get("validation", {})
    is_valid = validation.get("is_valid", True)
    extracted = document.get("extracted_fields") or (document.get("extracted_json") or {}).get("extracted_fields", {})

    triggered_rules: list[dict[str, Any]] = []
    applied_tags: list[str] = []
    final_status = document.get("status", "processed")
    alerts: list[str] = []

    for rule in _ACTIVE_RULES:
        if not rule.get("enabled", True):
            continue

        conds = rule.get("conditions", {})
        matched = False

        # Condition: min_confidence
        if "min_confidence" in conds:
            if overall_conf >= conds["min_confidence"] and (not conds.get("require_valid") or is_valid):
                matched = True

        # Condition: max_confidence
        if "max_confidence" in conds:
            if overall_conf < conds["max_confidence"]:
                matched = True

        # Condition: document_type
        if "document_type" in conds:
            if conds["document_type"] == doc_type:
                # Check min_amount if present
                if "min_amount" in conds:
                    raw_amount = str(extracted.get("total_amount", "0")).replace(",", "").replace("$", "").replace("₹", "").strip()
                    try:
                        if float(raw_amount) >= conds["min_amount"]:
                            matched = True
                    except ValueError:
                        pass
                else:
                    matched = True

        # Condition: categories
        if "categories" in conds:
            if category in conds["categories"]:
                matched = True

        if matched:
            act = rule.get("action", {})
            target_status = act.get("target_status")
            if target_status:
                final_status = target_status
            tag = act.get("tag")
            if tag:
                applied_tags.append(tag)
            notif = act.get("notification")
            if notif:
                alerts.append(notif)
            triggered_rules.append({
                "rule_id": rule["id"],
                "rule_name": rule["name"],
                "rule_type": rule["rule_type"],
                "action": act,
            })

    # Log entry
    log_entry = {
        "id": f"log-{uuid.uuid4().hex[:8]}",
        "document_id": doc_id,
        "owner_id": owner_id,
        "filename": filename,
        "document_type": doc_type,
        "category": category,
        "confidence": overall_conf,
        "triggered_rules_count": len(triggered_rules),
        "triggered_rules": [r["rule_name"] for r in triggered_rules],
        "resulting_status": final_status,
        "tags": applied_tags,
        "alerts": alerts,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    _EXECUTION_LOGS.append(log_entry)

    return {
        "document_id": doc_id,
        "final_status": final_status,
        "applied_tags": applied_tags,
        "triggered_rules": triggered_rules,
        "alerts": alerts,
        "log_id": log_entry["id"],
    }
