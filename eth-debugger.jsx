import { useState, useRef, useEffect } from "react";

const SYSTEM_PROMPT = `You are an expert Ethereum/Solidity smart contract debugger and auditor. 
When given Solidity or blockchain code, you must:
1. Identify ALL bugs, vulnerabilities, and issues (security, logic, gas optimization, best practices)
2. Categorize each issue by severity: CRITICAL 🔴, HIGH 🟠, MEDIUM 🟡, LOW 🟢, INFO ℹ️
3. Explain each issue clearly in Arabic and English
4. Provide the FIXED version of the code with inline comments showing what changed
5. Give a security score out of 100
6. List gas optimization tips
7. Check for common vulnerabilities: reentrancy, integer overflow/underflow, access control, front-running, timestamp dependence, etc.

Format your response as JSON with this structure:
{
  "securityScore": number,
  "summary": "brief summary in Arabic",
  "issues": [
    {
      "severity": "CRITICAL|HIGH|MEDIUM|LOW|INFO",
      "title": "issue title",
      "description": "detailed explanation",
      "line": "line number or range if known",
      "fix": "how to fix it"
    }
  ],
  "fixedCode": "the complete fixed Solidity code",
  "gasOptimizations": ["tip1", "tip2"],
  "verdict": "SAFE|CAUTION|DANGEROUS"
}
Return ONLY the JSON object, no markdown, no extra text.`;

const severityConfig = {
  CRITICAL: { color: "#ff3366", bg: "#ff336615", icon: "🔴", label: "حرج" },
  HIGH:     { color: "#ff6b35", bg: "#ff6b3515", icon: "🟠", label: "عالي" },
  MEDIUM:   { color: "#ffd700", bg: "#ffd70015", icon: "🟡", label: "متوسط" },
  LOW:      { color: "#00ff88", bg: "#00ff8815", icon: "🟢", label: "منخفض" },
  INFO:     { color: "#00bfff", bg: "#00bfff15", icon: "ℹ️", label: "معلومة" },
};

const verdictConfig = {
  SAFE:      { color: "#00ff88", label: "آمن ✓", bg: "#00ff8820" },
  CAUTION:   { color: "#ffd700", label: "تحذير ⚠️", bg: "#ffd70020" },
  DANGEROUS: { color: "#ff3366", label: "خطر ✗", bg: "#ff336620" },
};

const defaultCode = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract VulnerableBank {
    mapping(address => uint256) public balances;
    
    function deposit() public payable {
        balances[msg.sender] += msg.value;
    }
    
    function withdraw(uint256 amount) public {
        require(balances[msg.sender] >= amount);
        
        // ⚠️ هذا الكود يحتوي على ثغرة Reentrancy
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success);
        
        balances[msg.sender] -= amount;
    }
    
    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }
}`;

export default function EthDebugger() {
  const [code, setCode] = useState(defaultCode);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("issues");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const textareaRef = useRef(null);

  const analyzeCode = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    setActiveTab("issues");

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: `Analyze this Solidity/blockchain code:\n\n${code}` }],
        }),
      });

      const data = await response.json();
      const text = data.content?.map(i => i.text || "").join("") || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setResult(parsed);
    } catch (err) {
      setError("فشل في تحليل الكود. تأكد من صحة الكود وحاول مجدداً.");
    }
    setLoading(false);
  };

  const copyFixed = () => {
    if (result?.fixedCode) {
      navigator.clipboard.writeText(result.fixedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const scoreColor = (score) => {
    if (score >= 80) return "#00ff88";
    if (score >= 50) return "#ffd700";
    return "#ff3366";
  };

  const issueCount = (sev) => result?.issues?.filter(i => i.severity === sev).length || 0;

  return (
    <div style={{
      fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      background: "#0a0a0f",
      minHeight: "100vh",
      color: "#e0e0ff",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        borderBottom: "1px solid #1a1a2e",
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        gap: "14px",
        background: "linear-gradient(90deg, #0a0a0f 0%, #0d0d1a 100%)",
      }}>
        <div style={{
          width: 36, height: 36,
          background: "linear-gradient(135deg, #6272a4, #bd93f9)",
          borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18,
        }}>⬡</div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#bd93f9", letterSpacing: 1 }}>
            ETH DEBUGGER
          </div>
          <div style={{ fontSize: 10, color: "#6272a4", letterSpacing: 2 }}>
            SOLIDITY SMART CONTRACT ANALYZER
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {["CRITICAL","HIGH","MEDIUM","LOW"].map(s => (
            <div key={s} style={{
              fontSize: 10, padding: "2px 8px",
              background: severityConfig[s].bg,
              color: severityConfig[s].color,
              borderRadius: 4,
              border: `1px solid ${severityConfig[s].color}33`,
            }}>
              {severityConfig[s].icon} {issueCount(s)}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Code Editor */}
        <div style={{
          width: "45%",
          borderRight: "1px solid #1a1a2e",
          display: "flex",
          flexDirection: "column",
        }}>
          <div style={{
            padding: "10px 16px",
            borderBottom: "1px solid #1a1a2e",
            display: "flex", alignItems: "center", gap: 8,
            background: "#0c0c18",
          }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5555" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ffd700" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#50fa7b" }} />
            <span style={{ marginLeft: 8, fontSize: 11, color: "#6272a4" }}>smart_contract.sol</span>
          </div>

          <textarea
            ref={textareaRef}
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="// الصق كود Solidity هنا..."
            style={{
              flex: 1,
              background: "#0c0c18",
              color: "#f8f8f2",
              border: "none",
              outline: "none",
              padding: "16px",
              fontSize: 13,
              lineHeight: 1.7,
              fontFamily: "'JetBrains Mono', monospace",
              resize: "none",
              direction: "ltr",
            }}
          />

          <div style={{ padding: 12, borderTop: "1px solid #1a1a2e", background: "#0c0c18" }}>
            <button
              onClick={analyzeCode}
              disabled={loading || !code.trim()}
              style={{
                width: "100%",
                padding: "12px",
                background: loading ? "#1a1a2e" : "linear-gradient(135deg, #6272a4, #bd93f9)",
                color: loading ? "#6272a4" : "#fff",
                border: "none",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                letterSpacing: 1,
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {loading ? (
                <>
                  <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
                  جاري التحليل...
                </>
              ) : "🔍 تحليل الكود"}
            </button>
          </div>
        </div>

        {/* Results Panel */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {!result && !loading && !error && (
            <div style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
              flexDirection: "column", gap: 12, color: "#6272a4",
            }}>
              <div style={{ fontSize: 48, opacity: 0.3 }}>⬡</div>
              <div style={{ fontSize: 14, textAlign: "center", direction: "rtl" }}>
                الصق كود Solidity في المحرر<br />واضغط على "تحليل الكود"
              </div>
            </div>
          )}

          {error && (
            <div style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
              flexDirection: "column", gap: 8, color: "#ff3366",
            }}>
              <div style={{ fontSize: 32 }}>✗</div>
              <div style={{ direction: "rtl", textAlign: "center", fontSize: 13 }}>{error}</div>
            </div>
          )}

          {loading && (
            <div style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
              flexDirection: "column", gap: 16,
            }}>
              <div style={{
                width: 60, height: 60,
                border: "3px solid #1a1a2e",
                borderTop: "3px solid #bd93f9",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }} />
              <div style={{ color: "#6272a4", fontSize: 12, letterSpacing: 2 }}>
                ANALYZING SMART CONTRACT...
              </div>
            </div>
          )}

          {result && (
            <>
              {/* Score Bar */}
              <div style={{
                padding: "12px 20px",
                borderBottom: "1px solid #1a1a2e",
                background: "#0c0c18",
                display: "flex",
                alignItems: "center",
                gap: 16,
                direction: "rtl",
              }}>
                <div style={{
                  background: verdictConfig[result.verdict]?.bg || "#1a1a2e",
                  color: verdictConfig[result.verdict]?.color || "#fff",
                  padding: "4px 12px",
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 700,
                  border: `1px solid ${verdictConfig[result.verdict]?.color || "#6272a4"}44`,
                }}>
                  {verdictConfig[result.verdict]?.label || result.verdict}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{
                    height: 6, background: "#1a1a2e", borderRadius: 3, overflow: "hidden",
                  }}>
                    <div style={{
                      width: `${result.securityScore}%`,
                      height: "100%",
                      background: `linear-gradient(90deg, ${scoreColor(result.securityScore)}, ${scoreColor(result.securityScore)}88)`,
                      borderRadius: 3,
                      transition: "width 1s ease",
                    }} />
                  </div>
                </div>

                <div style={{
                  fontSize: 20, fontWeight: 700,
                  color: scoreColor(result.securityScore),
                  minWidth: 50,
                }}>
                  {result.securityScore}<span style={{ fontSize: 11, color: "#6272a4" }}>/100</span>
                </div>
              </div>

              {/* Summary */}
              {result.summary && (
                <div style={{
                  padding: "8px 20px",
                  borderBottom: "1px solid #1a1a2e",
                  fontSize: 12,
                  color: "#8be9fd",
                  direction: "rtl",
                  background: "#0d0d1a",
                }}>
                  {result.summary}
                </div>
              )}

              {/* Tabs */}
              <div style={{
                display: "flex",
                borderBottom: "1px solid #1a1a2e",
                background: "#0c0c18",
              }}>
                {["issues","fixed","gas"].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      padding: "10px 18px",
                      background: "none",
                      border: "none",
                      borderBottom: activeTab === tab ? "2px solid #bd93f9" : "2px solid transparent",
                      color: activeTab === tab ? "#bd93f9" : "#6272a4",
                      cursor: "pointer",
                      fontSize: 11,
                      letterSpacing: 1,
                      fontFamily: "inherit",
                      fontWeight: activeTab === tab ? 700 : 400,
                    }}
                  >
                    {tab === "issues" ? `المشاكل (${result.issues?.length || 0})` :
                     tab === "fixed" ? "الكود المُصلح" : "تحسين الغاز"}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>

                {activeTab === "issues" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {result.issues?.length === 0 && (
                      <div style={{ textAlign: "center", color: "#00ff88", padding: 32, direction: "rtl" }}>
                        ✓ لم يتم العثور على مشاكل!
                      </div>
                    )}
                    {result.issues?.map((issue, i) => {
                      const cfg = severityConfig[issue.severity] || severityConfig.INFO;
                      return (
                        <div key={i} style={{
                          background: cfg.bg,
                          border: `1px solid ${cfg.color}33`,
                          borderLeft: `3px solid ${cfg.color}`,
                          borderRadius: 6,
                          padding: "12px 14px",
                          direction: "rtl",
                        }}>
                          <div style={{
                            display: "flex", alignItems: "center", gap: 8, marginBottom: 6,
                          }}>
                            <span style={{
                              fontSize: 9, padding: "2px 6px",
                              background: cfg.bg,
                              color: cfg.color,
                              border: `1px solid ${cfg.color}55`,
                              borderRadius: 3,
                              fontWeight: 700,
                              letterSpacing: 1,
                            }}>
                              {cfg.icon} {cfg.label}
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#f8f8f2" }}>
                              {issue.title}
                            </span>
                            {issue.line && (
                              <span style={{ marginRight: "auto", fontSize: 10, color: "#6272a4" }}>
                                سطر {issue.line}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: "#b0b0cc", lineHeight: 1.6, marginBottom: 6 }}>
                            {issue.description}
                          </div>
                          {issue.fix && (
                            <div style={{
                              fontSize: 11, color: "#50fa7b",
                              background: "#50fa7b0a",
                              border: "1px solid #50fa7b22",
                              borderRadius: 4,
                              padding: "6px 10px",
                            }}>
                              💡 {issue.fix}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {activeTab === "fixed" && (
                  <div>
                    <div style={{
                      display: "flex", justifyContent: "space-between",
                      alignItems: "center", marginBottom: 10,
                    }}>
                      <span style={{ fontSize: 11, color: "#6272a4" }}>fixed_contract.sol</span>
                      <button
                        onClick={copyFixed}
                        style={{
                          padding: "4px 12px",
                          background: copied ? "#00ff8820" : "#1a1a2e",
                          color: copied ? "#00ff88" : "#6272a4",
                          border: `1px solid ${copied ? "#00ff8844" : "#2a2a3e"}`,
                          borderRadius: 4,
                          fontSize: 11,
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        {copied ? "✓ تم النسخ" : "نسخ الكود"}
                      </button>
                    </div>
                    <pre style={{
                      background: "#0c0c18",
                      border: "1px solid #1a1a2e",
                      borderRadius: 6,
                      padding: 16,
                      fontSize: 12,
                      lineHeight: 1.6,
                      color: "#f8f8f2",
                      overflow: "auto",
                      direction: "ltr",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}>
                      {result.fixedCode}
                    </pre>
                  </div>
                )}

                {activeTab === "gas" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {result.gasOptimizations?.map((tip, i) => (
                      <div key={i} style={{
                        background: "#00bfff10",
                        border: "1px solid #00bfff22",
                        borderLeft: "3px solid #00bfff",
                        borderRadius: 6,
                        padding: "10px 14px",
                        fontSize: 12,
                        color: "#b0b0cc",
                        direction: "rtl",
                        lineHeight: 1.6,
                      }}>
                        ⚡ {tip}
                      </div>
                    ))}
                    {(!result.gasOptimizations || result.gasOptimizations.length === 0) && (
                      <div style={{ textAlign: "center", color: "#6272a4", padding: 32, direction: "rtl" }}>
                        لا توجد تحسينات مقترحة
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #0a0a0f; }
        ::-webkit-scrollbar-thumb { background: #1a1a2e; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #6272a4; }
        textarea::placeholder { color: #3a3a5e; }
      `}</style>
    </div>
  );
}
