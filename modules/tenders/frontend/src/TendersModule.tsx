import { ClipboardList, Pencil, Plus, Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../../../apps/web/src/i18n/I18nProvider';
import { useNotifications } from '../../../../apps/web/src/shell/Notifications';
import {
  createProcurementContract,
  getTendersOverview,
  listProcurementContracts,
  updateProcurementContract,
  type ProcurementContractSummary,
  type ProcurementItemInput,
  type ProcurementItemUnit,
  type ProcurementType,
  type TenderType,
  type TendersOverview
} from './api';

type ViewMode = 'list' | 'create' | 'edit';
type PanelMode = 'closed' | 'detail';
type DraftItem = ProcurementItemInput & { id: string };

const TENDER_TYPES: TenderType[] = ['survey', 'competition'];
const PROCUREMENT_TYPES: ProcurementType[] = ['goods', 'services', 'works'];
const PROCUREMENT_ITEM_UNITS: ProcurementItemUnit[] = ['pcs', 'm', 'kg'];
const CAPABILITY_TRANSLATION_KEYS: Record<string, string> = {
  'Tender records': 'tenders.capabilities.tenderRecords',
  Measures: 'tenders.capabilities.measures',
  'Procurement contracts': 'tenders.capabilities.procurementContracts',
  'Procurement items': 'tenders.capabilities.procurementItems',
  'Contract list and creation': 'tenders.capabilities.contractListAndCreation'
};

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function numberToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : null;
}

function stringFromNumber(value: number | null) {
  return value === null ? '' : String(value);
}

function draftId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function money(value: number | null, locale: 'en' | 'sk') {
  if (value === null) {
    return '-';
  }

  return new Intl.NumberFormat(locale === 'sk' ? 'sk-SK' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

export function TendersModule() {
  const { locale, t } = useI18n();
  const { notify } = useNotifications();
  const [overview, setOverview] = useState<TendersOverview | null>(null);
  const [procurementContracts, setProcurementContracts] = useState<ProcurementContractSummary[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [panelMode, setPanelMode] = useState<PanelMode>('closed');
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [tenderType, setTenderType] = useState<TenderType>('survey');
  const [josephineExternalId, setJosephineExternalId] = useState('');
  const [measureNumber, setMeasureNumber] = useState('');
  const [measureSubNumber, setMeasureSubNumber] = useState('');
  const [callNumber, setCallNumber] = useState('');
  const [procurementType, setProcurementType] = useState<ProcurementType | ''>('');
  const [contractName, setContractName] = useState('');
  const [lotDivision, setLotDivision] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectCode, setProjectCode] = useState('');
  const [cpvCode, setCpvCode] = useState('');
  const [contractType, setContractType] = useState('');
  const [deliveryAddressStreetNumber, setDeliveryAddressStreetNumber] = useState('');
  const [deliveryAddressPostalCode, setDeliveryAddressPostalCode] = useState('');
  const [deliveryAddressCity, setDeliveryAddressCity] = useState('');
  const [estimatedValueExclVat, setEstimatedValueExclVat] = useState('');
  const [estimatedValueInclVat, setEstimatedValueInclVat] = useState('');
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);

  const selectedContract = useMemo(
    () => procurementContracts.find((contract) => contract.id === selectedContractId) ?? null,
    [procurementContracts, selectedContractId]
  );

  async function loadProcurementContracts() {
    const { procurementContracts: loadedProcurementContracts } = await listProcurementContracts();
    setProcurementContracts(loadedProcurementContracts);
  }

  useEffect(() => {
    getTendersOverview()
      .then(setOverview)
      .catch(() => setOverview(null));
    void loadProcurementContracts();
  }, []);

  function resetForm() {
    setTenderType('survey');
    setJosephineExternalId('');
    setMeasureNumber('');
    setMeasureSubNumber('');
    setCallNumber('');
    setProcurementType('');
    setContractName('');
    setLotDivision('');
    setProjectName('');
    setProjectCode('');
    setCpvCode('');
    setContractType('');
    setDeliveryAddressStreetNumber('');
    setDeliveryAddressPostalCode('');
    setDeliveryAddressCity('');
    setEstimatedValueExclVat('');
    setEstimatedValueInclVat('');
    setDraftItems([]);
  }

  function loadContractIntoForm(contract: ProcurementContractSummary) {
    setTenderType(contract.tenderType);
    setJosephineExternalId(contract.josephineExternalId ?? '');
    setMeasureNumber(contract.measureNumber ?? '');
    setMeasureSubNumber(contract.measureSubNumber ?? '');
    setCallNumber(contract.callNumber ?? '');
    setProcurementType(contract.procurementType ?? '');
    setContractName(contract.name);
    setLotDivision(contract.lotDivision ?? '');
    setProjectName(contract.projectName ?? '');
    setProjectCode(contract.projectCode ?? '');
    setCpvCode(contract.cpvCode ?? '');
    setContractType(contract.contractType ?? '');
    setDeliveryAddressStreetNumber(contract.deliveryAddressStreetNumber ?? '');
    setDeliveryAddressPostalCode(contract.deliveryAddressPostalCode ?? '');
    setDeliveryAddressCity(contract.deliveryAddressCity ?? '');
    setEstimatedValueExclVat(stringFromNumber(contract.estimatedValueExclVat));
    setEstimatedValueInclVat(stringFromNumber(contract.estimatedValueInclVat));
    setDraftItems(
      contract.items.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        estimatedValueExclVat: item.estimatedValueExclVat,
        estimatedValueInclVat: item.estimatedValueInclVat
      }))
    );
  }

  function buildContractInput() {
    return {
      tenderType,
      josephineExternalId: emptyToNull(josephineExternalId),
      measureNumber: emptyToNull(measureNumber),
      measureSubNumber: emptyToNull(measureSubNumber),
      callNumber: emptyToNull(callNumber),
      procurementType: procurementType || null,
      name: contractName.trim(),
      lotDivision: emptyToNull(lotDivision),
      projectName: emptyToNull(projectName),
      projectCode: emptyToNull(projectCode),
      cpvCode: emptyToNull(cpvCode),
      contractType: emptyToNull(contractType),
      deliveryAddressStreetNumber: emptyToNull(deliveryAddressStreetNumber),
      deliveryAddressPostalCode: emptyToNull(deliveryAddressPostalCode),
      deliveryAddressCity: emptyToNull(deliveryAddressCity),
      estimatedValueExclVat: numberToNull(estimatedValueExclVat),
      estimatedValueInclVat: numberToNull(estimatedValueInclVat),
      items: draftItems
        .filter((item) => item.name.trim())
        .map((item) => ({
          name: item.name.trim(),
          description: emptyToNull(item.description ?? ''),
          quantity: typeof item.quantity === 'number' ? item.quantity : null,
          unit: item.unit || null,
          estimatedValueExclVat: typeof item.estimatedValueExclVat === 'number' ? item.estimatedValueExclVat : null,
          estimatedValueInclVat: typeof item.estimatedValueInclVat === 'number' ? item.estimatedValueInclVat : null
        }))
    };
  }

  function openCreate() {
    resetForm();
    setSelectedContractId(null);
    setPanelMode('closed');
    setViewMode('create');
  }

  function openDetail(contractId: string) {
    setSelectedContractId(contractId);
    setPanelMode('detail');
  }

  function openEdit(contract: ProcurementContractSummary) {
    setSelectedContractId(contract.id);
    loadContractIntoForm(contract);
    setPanelMode('closed');
    setViewMode('edit');
  }

  function closePanel() {
    setPanelMode('closed');
  }

  function closeMainForm() {
    resetForm();
    setViewMode('list');
    setPanelMode('closed');
  }

  function addDraftItem() {
    setDraftItems((items) => [
      ...items,
      {
        id: draftId(),
        name: '',
        description: null,
        quantity: null,
        unit: null,
        estimatedValueExclVat: null,
        estimatedValueInclVat: null
      }
    ]);
  }

  function updateDraftItem(itemId: string, updates: Partial<DraftItem>) {
    setDraftItems((items) => items.map((item) => (item.id === itemId ? { ...item, ...updates } : item)));
  }

  function removeDraftItem(itemId: string) {
    setDraftItems((items) => items.filter((item) => item.id !== itemId));
  }

  async function handleCreateProcurementContract(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const created = await createProcurementContract(buildContractInput());
      notify({ type: 'success', message: t('tenders.procurementContracts.created') });
      await loadProcurementContracts();
      setSelectedContractId(created.procurementContract.id);
      resetForm();
      setViewMode('list');
      setPanelMode('detail');
    } catch {
      notify({ type: 'error', message: t('tenders.procurementContracts.createError') });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateProcurementContract(event: FormEvent) {
    event.preventDefault();

    if (!selectedContractId) {
      return;
    }

    setSubmitting(true);

    try {
      await updateProcurementContract(selectedContractId, buildContractInput());
      notify({ type: 'success', message: t('tenders.procurementContracts.updated') });
      await loadProcurementContracts();
      resetForm();
      setViewMode('list');
      setPanelMode('detail');
    } catch {
      notify({ type: 'error', message: t('tenders.procurementContracts.updateError') });
    } finally {
      setSubmitting(false);
    }
  }

  function renderItems(items: ProcurementContractSummary['items']) {
    return (
      <div className="compact-list">
        {items.map((item) => (
          <article className="compact-item" key={item.id}>
            <strong>{item.name}</strong>
            {item.description ? <span>{item.description}</span> : null}
            <span>
              {[
                item.quantity === null ? null : money(item.quantity, locale),
                item.unit ? t(`tenders.procurementItems.unit.${item.unit}`) : null,
                money(item.estimatedValueExclVat, locale)
              ]
                .filter(Boolean)
                .join(' / ') || '-'}
            </span>
          </article>
        ))}
        {items.length === 0 ? <p className="helper-text">{t('tenders.procurementItems.empty')}</p> : null}
      </div>
    );
  }

  function renderDraftItems() {
    return (
      <section className="draft-section">
        <div className="section-heading-row">
          <h3>{t('tenders.procurementItems.title')}</h3>
          <button className="icon-text-button" type="button" onClick={addDraftItem}>
            <Plus aria-hidden="true" />
            {t('tenders.procurementItems.add')}
          </button>
        </div>
        <div className="inline-edit-list">
          {draftItems.map((item) => (
            <article className="compact-item associated-edit-item" key={item.id}>
              <div className="form-grid">
                <label>
                  {t('tenders.procurementItems.name')}
                  <input
                    value={item.name}
                    onChange={(event) => updateDraftItem(item.id, { name: event.target.value })}
                    required
                  />
                </label>
                <label>
                  {t('tenders.procurementItems.description')}
                  <input
                    value={item.description ?? ''}
                    onChange={(event) => updateDraftItem(item.id, { description: event.target.value })}
                  />
                </label>
                <label>
                  {t('tenders.procurementItems.quantity')}
                  <input
                    min="0"
                    step="0.01"
                    type="number"
                    value={stringFromNumber(item.quantity ?? null)}
                    onChange={(event) => updateDraftItem(item.id, { quantity: numberToNull(event.target.value) })}
                  />
                </label>
                <label>
                  {t('tenders.procurementItems.unit')}
                  <select
                    value={item.unit ?? ''}
                    onChange={(event) =>
                      updateDraftItem(item.id, { unit: (event.target.value || null) as ProcurementItemUnit | null })
                    }
                  >
                    <option value="">{t('tenders.none')}</option>
                    {PROCUREMENT_ITEM_UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {t(`tenders.procurementItems.unit.${unit}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t('tenders.procurementItems.estimatedValueExclVat')}
                  <input
                    min="0"
                    step="0.01"
                    type="number"
                    value={stringFromNumber(item.estimatedValueExclVat ?? null)}
                    onChange={(event) =>
                      updateDraftItem(item.id, { estimatedValueExclVat: numberToNull(event.target.value) })
                    }
                  />
                </label>
                <label>
                  {t('tenders.procurementItems.estimatedValueInclVat')}
                  <input
                    min="0"
                    step="0.01"
                    type="number"
                    value={stringFromNumber(item.estimatedValueInclVat ?? null)}
                    onChange={(event) =>
                      updateDraftItem(item.id, { estimatedValueInclVat: numberToNull(event.target.value) })
                    }
                  />
                </label>
              </div>
              <button
                aria-label={t('tenders.remove')}
                className="icon-only-button"
                type="button"
                onClick={() => removeDraftItem(item.id)}
              >
                <Trash2 aria-hidden="true" />
              </button>
            </article>
          ))}
          {draftItems.length === 0 ? <p className="helper-text">{t('tenders.procurementItems.empty')}</p> : null}
        </div>
      </section>
    );
  }

  function renderContractForm(mode: 'create' | 'edit') {
    return (
      <form
        className="side-panel-form"
        onSubmit={mode === 'create' ? handleCreateProcurementContract : handleUpdateProcurementContract}
      >
        <div className="panel-heading">
          <div>
            {mode === 'edit' ? <span className="eyebrow">{t('tenders.selected')}</span> : null}
            <h2>{mode === 'create' ? t('tenders.procurementContracts.create') : t('tenders.procurementContracts.edit')}</h2>
            <p className="helper-text">{t('tenders.procurementContracts.minimumRequired')}</p>
          </div>
          <button className="icon-text-button" type="button" onClick={closeMainForm}>
            {t('tenders.cancel')}
          </button>
        </div>

        <section className="draft-section">
          <span className="eyebrow">{t('tenders.tender')}</span>
          <div className="form-grid">
            <label>
              {t('tenders.procurementContracts.tenderType')}
              <select required value={tenderType} onChange={(event) => setTenderType(event.target.value as TenderType)}>
                {TENDER_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`tenders.tenderType.${type}`)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('tenders.procurementContracts.josephineExternalId')}
              <input
                maxLength={20}
                value={josephineExternalId}
                onChange={(event) => setJosephineExternalId(event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="draft-section">
          <span className="eyebrow">{t('tenders.measure')}</span>
          <div className="form-grid">
            <label>
              {t('tenders.procurementContracts.measureNumber')}
              <input value={measureNumber} onChange={(event) => setMeasureNumber(event.target.value)} />
            </label>
            <label>
              {t('tenders.procurementContracts.measureSubNumber')}
              <input value={measureSubNumber} onChange={(event) => setMeasureSubNumber(event.target.value)} />
            </label>
            <label>
              {t('tenders.procurementContracts.callNumber')}
              <input value={callNumber} onChange={(event) => setCallNumber(event.target.value)} />
            </label>
            <label>
              {t('tenders.procurementContracts.procurementType')}
              <select
                value={procurementType}
                onChange={(event) => setProcurementType(event.target.value as ProcurementType | '')}
              >
                <option value="">{t('tenders.none')}</option>
                {PROCUREMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`tenders.procurementType.${type}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="draft-section">
          <span className="eyebrow">{t('tenders.procurementContract')}</span>
          <label>
            {t('tenders.procurementContracts.name')}
            <input value={contractName} onChange={(event) => setContractName(event.target.value)} required />
          </label>
          <div className="form-grid">
            <label>
              {t('tenders.procurementContracts.lotDivision')}
              <input value={lotDivision} onChange={(event) => setLotDivision(event.target.value)} />
            </label>
            <label>
              {t('tenders.procurementContracts.contractType')}
              <input value={contractType} onChange={(event) => setContractType(event.target.value)} />
            </label>
            <label>
              {t('tenders.procurementContracts.projectName')}
              <input value={projectName} onChange={(event) => setProjectName(event.target.value)} />
            </label>
            <label>
              {t('tenders.procurementContracts.projectCode')}
              <input value={projectCode} onChange={(event) => setProjectCode(event.target.value)} />
            </label>
            <label>
              {t('tenders.procurementContracts.cpvCode')}
              <input value={cpvCode} onChange={(event) => setCpvCode(event.target.value)} />
            </label>
          </div>
        </section>

        <section className="draft-section">
          <span className="eyebrow">{t('tenders.delivery')}</span>
          <div className="form-grid">
            <label>
              {t('tenders.procurementContracts.deliveryAddressStreetNumber')}
              <input
                value={deliveryAddressStreetNumber}
                onChange={(event) => setDeliveryAddressStreetNumber(event.target.value)}
              />
            </label>
            <label>
              {t('tenders.procurementContracts.deliveryAddressPostalCode')}
              <input
                value={deliveryAddressPostalCode}
                onChange={(event) => setDeliveryAddressPostalCode(event.target.value)}
              />
            </label>
            <label>
              {t('tenders.procurementContracts.deliveryAddressCity')}
              <input value={deliveryAddressCity} onChange={(event) => setDeliveryAddressCity(event.target.value)} />
            </label>
          </div>
        </section>

        <section className="draft-section">
          <span className="eyebrow">{t('tenders.values')}</span>
          <div className="form-grid">
            <label>
              {t('tenders.procurementContracts.estimatedValueExclVat')}
              <input
                min="0"
                step="0.01"
                type="number"
                value={estimatedValueExclVat}
                onChange={(event) => setEstimatedValueExclVat(event.target.value)}
              />
            </label>
            <label>
              {t('tenders.procurementContracts.estimatedValueInclVat')}
              <input
                min="0"
                step="0.01"
                type="number"
                value={estimatedValueInclVat}
                onChange={(event) => setEstimatedValueInclVat(event.target.value)}
              />
            </label>
          </div>
        </section>

        {renderDraftItems()}

        <div className="create-step-actions">
          <button className="icon-text-button" type="button" onClick={closeMainForm}>
            {t('tenders.cancel')}
          </button>
          <button className="primary-button" disabled={submitting || !contractName.trim()} type="submit">
            {mode === 'create' ? t('tenders.procurementContracts.create') : t('tenders.save')}
          </button>
        </div>
      </form>
    );
  }

  return (
    <main className="page">
      <section className="page-header">
        <div>
          <span className="eyebrow">{t('tenders.eyebrow')}</span>
          <h1>{t('tenders.title')}</h1>
        </div>
        {viewMode === 'list' ? (
          <button className="primary-button page-action-button" type="button" onClick={openCreate}>
            <Plus aria-hidden="true" />
            {t('tenders.procurementContracts.create')}
          </button>
        ) : null}
      </section>

      {viewMode === 'list' ? (
        <>
          <div className="status-row">
            {(overview?.capabilities ?? [t('tenders.backendPending')]).map((capability) => (
              <span className="permission-count" key={capability}>
                {CAPABILITY_TRANSLATION_KEYS[capability] ? t(CAPABILITY_TRANSLATION_KEYS[capability]) : capability}
              </span>
            ))}
          </div>

          <section className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('tenders.procurementContracts.name')}</th>
                  <th>{t('tenders.procurementContracts.tenderType')}</th>
                  <th>{t('tenders.procurementContracts.josephineExternalId')}</th>
                  <th>{t('tenders.procurementContracts.measure')}</th>
                  <th>{t('tenders.procurementContracts.procurementType')}</th>
                  <th>{t('tenders.procurementContracts.project')}</th>
                  <th>{t('tenders.procurementContracts.cpvCode')}</th>
                  <th>{t('tenders.procurementItems.title')}</th>
                  <th className="table-action-column">{t('tenders.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {procurementContracts.map((contract) => (
                  <tr
                    className={contract.id === selectedContractId ? 'selected-row' : undefined}
                    key={contract.id}
                    onClick={() => openDetail(contract.id)}
                  >
                    <td>
                      <strong>{contract.name}</strong>
                    </td>
                    <td>{t(`tenders.tenderType.${contract.tenderType}`)}</td>
                    <td>{contract.josephineExternalId ?? '-'}</td>
                    <td>
                      {[contract.measureNumber, contract.measureSubNumber, contract.callNumber]
                        .filter(Boolean)
                        .join(' / ') || '-'}
                    </td>
                    <td>{contract.procurementType ? t(`tenders.procurementType.${contract.procurementType}`) : '-'}</td>
                    <td>{contract.projectName ?? contract.projectCode ?? '-'}</td>
                    <td>{contract.cpvCode ?? '-'}</td>
                    <td>{contract.items.length}</td>
                    <td className="table-action-column">
                      <button
                        className="icon-text-button"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEdit(contract);
                        }}
                      >
                        <Pencil aria-hidden="true" />
                        {t('tenders.edit')}
                      </button>
                    </td>
                  </tr>
                ))}
                {procurementContracts.length === 0 ? (
                  <tr>
                    <td colSpan={9}>{t('tenders.procurementContracts.empty')}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>
        </>
      ) : null}

      {viewMode !== 'list' ? (
        <section
          aria-label={t(viewMode === 'create' ? 'tenders.panel.create' : 'tenders.panel.edit')}
          className="side-panel create-side-panel company-main-panel"
        >
          {viewMode === 'create' ? renderContractForm('create') : null}
          {viewMode === 'edit' && selectedContract ? renderContractForm('edit') : null}
        </section>
      ) : null}

      {panelMode === 'detail' && selectedContract ? (
        <aside aria-label={t('tenders.panel.detail')} className="side-panel detail-side-panel">
          <div className="side-panel-form">
            <div className="panel-heading">
              <div className="detail-heading">
                <ClipboardList aria-hidden="true" />
                <div>
                  <span className="eyebrow">{t('tenders.selected')}</span>
                  <h2>{selectedContract.name}</h2>
                </div>
              </div>
              <button className="icon-text-button" type="button" onClick={closePanel}>
                {t('tenders.cancel')}
              </button>
            </div>

            <dl className="detail-list">
              <div>
                <dt>{t('tenders.procurementContracts.tenderType')}</dt>
                <dd>{t(`tenders.tenderType.${selectedContract.tenderType}`)}</dd>
              </div>
              <div>
                <dt>{t('tenders.procurementContracts.josephineExternalId')}</dt>
                <dd>{selectedContract.josephineExternalId ?? '-'}</dd>
              </div>
              <div>
                <dt>{t('tenders.procurementContracts.measure')}</dt>
                <dd>
                  {[selectedContract.measureNumber, selectedContract.measureSubNumber, selectedContract.callNumber]
                    .filter(Boolean)
                    .join(' / ') || '-'}
                </dd>
              </div>
              <div>
                <dt>{t('tenders.procurementContracts.project')}</dt>
                <dd>{selectedContract.projectName ?? selectedContract.projectCode ?? '-'}</dd>
              </div>
              <div>
                <dt>{t('tenders.procurementContracts.cpvCode')}</dt>
                <dd>{selectedContract.cpvCode ?? '-'}</dd>
              </div>
              <div>
                <dt>{t('tenders.procurementContracts.estimatedValueExclVat')}</dt>
                <dd>{money(selectedContract.estimatedValueExclVat, locale)}</dd>
              </div>
            </dl>

            <section className="detail-section">
              <div className="section-heading-row">
                <h3>{t('tenders.procurementItems.title')}</h3>
              </div>
              {renderItems(selectedContract.items)}
            </section>
          </div>
        </aside>
      ) : null}
    </main>
  );
}
