import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Edit3, Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import { EXAM_CATEGORIES } from '../../shared/categories.ts';
import type { ExamDifficulty, ExamQuestion, QuestionType } from '../../shared/types.ts';
import { safeFetchJson } from '../utils/apiClient.ts';

const DEV_TOKEN = 'arcade-matrix-dev';

interface AdminFormState {
  id: string;
  question: string;
  subject: string;
  categoryId: string;
  chapter: string;
  topic: string;
  difficulty: ExamDifficulty;
  questionType: QuestionType;
  source: string;
  year: string;
  opt0: string;
  opt1: string;
  opt2: string;
  opt3: string;
  answerText: string;
  why: string;
  concept: string;
  shortcut: string;
  commonTrap: string;
  verified: boolean;
}

const EMPTY_FORM: AdminFormState = {
  id: '',
  question: '',
  subject: 'Physics',
  categoryId: 'physics',
  chapter: '',
  topic: '',
  difficulty: 'Medium',
  questionType: 'single',
  source: 'CGQUIZ GENERATED',
  year: '',
  opt0: '',
  opt1: '',
  opt2: '',
  opt3: '',
  answerText: '0',
  why: '',
  concept: '',
  shortcut: '',
  commonTrap: '',
  verified: true,
};

export const AdminQuestionsPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<AdminFormState>(EMPTY_FORM);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    const res = await safeFetchJson<{ questions?: ExamQuestion[] }>('/api/admin/questions', {
      headers: { 'x-cgquiz-dev': DEV_TOKEN },
    });
    if (res.ok && res.data) {
      setQuestions(res.data.questions || []);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const openEdit = (q: ExamQuestion) => {
    setForm({
      id: q.id,
      question: q.question,
      subject: q.subject,
      categoryId: q.categoryId,
      chapter: q.chapter,
      topic: q.topic,
      difficulty: q.difficulty,
      questionType: q.questionType,
      source: q.source,
      year: q.year ? String(q.year) : '',
      opt0: q.options[0] || '',
      opt1: q.options[1] || '',
      opt2: q.options[2] || '',
      opt3: q.options[3] || '',
      answerText: Array.isArray(q.answer) ? q.answer.join(',') : String(q.answer),
      why: q.explanation.why,
      concept: q.explanation.concept,
      shortcut: q.explanation.shortcut,
      commonTrap: q.explanation.commonTrap,
      verified: q.verified,
    });
    setFormOpen(true);
    setErrorMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);

    const options =
      form.questionType === 'truefalse'
        ? ['True', 'False']
        : form.questionType === 'integer'
          ? []
          : [form.opt0, form.opt1, form.opt2, form.opt3].map((s) => s.trim()).filter(Boolean);

    let answer: number | number[] | string = form.answerText.trim();
    if (form.questionType === 'multiple') {
      answer = form.answerText
        .split(',')
        .map((n) => Number(n.trim()))
        .filter((n) => !Number.isNaN(n));
    } else if (form.questionType !== 'integer') {
      answer = Number(form.answerText);
    }

    const payload = {
      id: form.id || undefined,
      question: form.question,
      subject: form.subject,
      categoryId: form.categoryId,
      chapter: form.chapter,
      topic: form.topic,
      difficulty: form.difficulty,
      questionType: form.questionType,
      source: form.source,
      year: form.year ? Number(form.year) : null,
      options,
      answer,
      verified: form.verified,
      explanation: {
        why: form.why,
        concept: form.concept,
        shortcut: form.shortcut,
        commonTrap: form.commonTrap,
      },
    };

    setSaving(true);
    try {
      const url = form.id
        ? `/api/admin/questions/${encodeURIComponent(form.id)}`
        : '/api/admin/questions';
      const method = form.id ? 'PUT' : 'POST';
      const res = await safeFetchJson<{ question?: ExamQuestion; error?: string }>(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-cgquiz-dev': DEV_TOKEN,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok || !res.data?.question) {
        setErrorMsg(res.error || 'Validation failed.');
        return;
      }
      setStatusMsg(`Saved question "${res.data.question.id}" successfully.`);
      setFormOpen(false);
      setForm(EMPTY_FORM);
      await loadAll();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await safeFetchJson(`/api/admin/questions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'x-cgquiz-dev': DEV_TOKEN },
    });
    setStatusMsg(`Removed custom override for "${id}".`);
    await loadAll();
  };

  const filtered = questions.filter((q) => {
    const s = search.trim().toLowerCase();
    if (!s) return true;
    return (
      q.question.toLowerCase().includes(s) ||
      q.subject.toLowerCase().includes(s) ||
      q.topic.toLowerCase().includes(s) ||
      q.id.toLowerCase().includes(s)
    );
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--exam-text)] flex items-center gap-2">
            <ShieldCheck size={22} className="text-[var(--exam-accent)]" /> Admin Question Manager
          </h1>
          <p className="text-sm text-[var(--exam-text-secondary)]">
            Add, edit, verify, or delete questions. Incomplete questions without explanations are rejected before publishing.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setForm(EMPTY_FORM);
              setErrorMsg(null);
              setFormOpen(true);
            }}
            className="exam-btn exam-btn-primary text-sm"
          >
            <Plus size={16} /> Add Question
          </button>
          <button type="button" onClick={onBack} className="exam-btn exam-btn-secondary text-sm">
            Back
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="px-4 py-2.5 rounded-lg bg-[var(--exam-success-soft)] border border-[var(--exam-success)] text-sm text-[var(--exam-text)] flex items-center gap-2">
          <CheckCircle2 size={16} className="text-[var(--exam-success)]" /> {statusMsg}
        </div>
      )}

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Filter questions by ID, subject, topic, or stem..."
        className="exam-input w-full px-4 py-2.5 text-sm"
      />

      <div className="space-y-2.5">
        {filtered.slice(0, 40).map((q) => (
          <div
            key={q.id}
            className="exam-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="text-xs font-code text-[var(--exam-text-muted)]">
                [{q.id}] · {q.subject} · {q.difficulty} · {q.source}
                {q.year ? ` ${q.year}` : ''} · {q.verified ? 'Verified' : 'Unverified'}
              </div>
              <div className="text-sm font-semibold text-[var(--exam-text)] truncate mt-0.5">
                {q.question}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => openEdit(q)}
                className="p-2 rounded border border-[var(--exam-border-strong)] text-xs flex items-center gap-1 cursor-pointer"
              >
                <Edit3 size={14} /> Edit
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(q.id)}
                className="p-2 rounded border border-[var(--exam-border-strong)] text-[var(--exam-danger)] cursor-pointer"
                aria-label="Delete custom question"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Question Modal */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setFormOpen(false)}
        >
          <div
            className="exam-card max-w-2xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--exam-text)]">
                {form.id ? `Edit Question (${form.id})` : 'Create Verified Question'}
              </h2>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="p-1.5 rounded border border-[var(--exam-border-strong)] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {errorMsg && (
              <div className="px-3 py-2 rounded bg-[var(--exam-danger-soft)] border border-[var(--exam-danger)] text-xs sm:text-sm text-[var(--exam-text)]">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3 text-sm">
              <textarea
                required
                rows={3}
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                placeholder="Question prompt (minimum 8 characters)..."
                className="exam-input w-full p-3"
              />

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  className="exam-input px-3 py-2"
                >
                  {EXAM_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  required
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="Subject"
                  className="exam-input px-3 py-2"
                />
                <input
                  required
                  value={form.chapter}
                  onChange={(e) => setForm({ ...form, chapter: e.target.value })}
                  placeholder="Chapter"
                  className="exam-input px-3 py-2"
                />
                <input
                  required
                  value={form.topic}
                  onChange={(e) => setForm({ ...form, topic: e.target.value })}
                  placeholder="Topic"
                  className="exam-input px-3 py-2"
                />
                <select
                  value={form.difficulty}
                  onChange={(e) => setForm({ ...form, difficulty: e.target.value as ExamDifficulty })}
                  className="exam-input px-3 py-2"
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                  <option value="Expert">Expert</option>
                </select>
                <select
                  value={form.questionType}
                  onChange={(e) => setForm({ ...form, questionType: e.target.value as QuestionType })}
                  className="exam-input px-3 py-2"
                >
                  <option value="single">Single MCQ</option>
                  <option value="multiple">Multiple Correct</option>
                  <option value="truefalse">True / False</option>
                  <option value="integer">Integer</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <input
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                  placeholder="Source (CGQUIZ GENERATED or JEE MAIN PYQ)"
                  className="exam-input px-3 py-2"
                />
                <input
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: e.target.value })}
                  placeholder="Year (optional for PYQ, e.g. 2022)"
                  className="exam-input px-3 py-2"
                />
              </div>

              {form.questionType !== 'integer' && form.questionType !== 'truefalse' && (
                <div className="grid sm:grid-cols-2 gap-2">
                  <input
                    value={form.opt0}
                    onChange={(e) => setForm({ ...form, opt0: e.target.value })}
                    placeholder="Option A (index 0)"
                    className="exam-input px-3 py-2"
                  />
                  <input
                    value={form.opt1}
                    onChange={(e) => setForm({ ...form, opt1: e.target.value })}
                    placeholder="Option B (index 1)"
                    className="exam-input px-3 py-2"
                  />
                  <input
                    value={form.opt2}
                    onChange={(e) => setForm({ ...form, opt2: e.target.value })}
                    placeholder="Option C (index 2)"
                    className="exam-input px-3 py-2"
                  />
                  <input
                    value={form.opt3}
                    onChange={(e) => setForm({ ...form, opt3: e.target.value })}
                    placeholder="Option D (index 3)"
                    className="exam-input px-3 py-2"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs text-[var(--exam-text-muted)] mb-1">
                  Answer ({form.questionType === 'multiple' ? 'comma indices e.g. 0,2' : form.questionType === 'integer' ? 'exact number' : 'index 0-3'})
                </label>
                <input
                  required
                  value={form.answerText}
                  onChange={(e) => setForm({ ...form, answerText: e.target.value })}
                  className="exam-input w-full px-3 py-2 font-code"
                />
              </div>

              <input
                required
                value={form.concept}
                onChange={(e) => setForm({ ...form, concept: e.target.value })}
                placeholder="Core Concept (Required)"
                className="exam-input w-full px-3 py-2"
              />
              <textarea
                required
                rows={2}
                value={form.why}
                onChange={(e) => setForm({ ...form, why: e.target.value })}
                placeholder="Explanation — Why this is correct (Required)"
                className="exam-input w-full p-2.5"
              />
              <div className="grid sm:grid-cols-2 gap-2">
                <input
                  value={form.shortcut}
                  onChange={(e) => setForm({ ...form, shortcut: e.target.value })}
                  placeholder="Quick Tip / Shortcut"
                  className="exam-input px-3 py-2"
                />
                <input
                  value={form.commonTrap}
                  onChange={(e) => setForm({ ...form, commonTrap: e.target.value })}
                  placeholder="Common Trap"
                  className="exam-input px-3 py-2"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-[var(--exam-text)]">
                <input
                  type="checkbox"
                  checked={form.verified}
                  onChange={(e) => setForm({ ...form, verified: e.target.checked })}
                />
                Mark as Verified & Publish to Active Question Bank
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="exam-btn exam-btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="exam-btn exam-btn-primary text-xs"
                >
                  {saving ? 'Validating...' : 'Validate & Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
