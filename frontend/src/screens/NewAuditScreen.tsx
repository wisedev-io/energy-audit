import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, SafeAreaView, Alert, Modal, ActivityIndicator, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Radius, Shadow, Space } from '../theme';
import BasicInfo from '../components/audit-steps/BasicInfo';
import BuildingInfo from '../components/audit-steps/BuildingInfo';
import SystemsEquipment from '../components/audit-steps/SystemsEquipment';
import MainAppliances from '../components/audit-steps/MainAppliances';
import Dimensions from '../components/audit-steps/Dimensions';
import EnergyConsumption from '../components/audit-steps/EnergyConsumption';
import BoilerSolar from '../components/audit-steps/BoilerSolar';
import Measurements from '../components/audit-steps/Measurements';
import Photos from '../components/audit-steps/Photos';
import Review from '../components/audit-steps/Review';
import { SECTION_SEC_ID } from '../components/audit-steps/Photos';
import { draftStorage, AuditDraft } from '../utils/draftStorage';
import DraftsScreen from './DraftsScreen';

const BASE_URL = 'http://157.180.28.98:5050';

const steps = [
  { id: 1,  name: 'Basic Info',   component: BasicInfo },
  { id: 2,  name: 'Building',     component: BuildingInfo },
  { id: 3,  name: 'Systems',      component: SystemsEquipment },
  { id: 4,  name: 'Appliances',   component: MainAppliances },
  { id: 5,  name: 'Dimensions',   component: Dimensions },
  { id: 6,  name: 'Energy Data',  component: EnergyConsumption },
  { id: 7,  name: 'Boiler/Solar', component: BoilerSolar },
  { id: 8,  name: 'Measurements', component: Measurements },
  { id: 9,  name: 'Photos',       component: Photos },
  { id: 10, name: 'Review',       component: Review },
];

function buildDefaults(caseNumber?: string): Record<string, any> {
  const today = new Date();
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return {
    ...(caseNumber ? { case_number: caseNumber } : {}),
    insp_date: fmt(today),
    aud_date: fmt(tomorrow),
    residents: '4',
    floors: '1', rooms: '4', sections: '1',
    yr_built: '2000', yr_renov: "Yo'q",
    wall_mat: "G'isht", wall_thick: '38', wall_insul: "Yo'q",
    roof_mat: 'Tekis tom', floor_mat: 'Beton', floor_insul: "Yo'q",
    win_mat: 'Plastik (PVC)', win_layers: '2', door_mat: 'Metall',
    heat_desc: 'Gaz qozoni', hotw_desc: 'Gaz suv isitgich',
    light_desc: 'LED', light_kw: '2.5',
    cool_desc: 'Split konditsioner', cool_kw: '3.5',
    vent_desc: 'Tabiiy', water_desc: "Markaziy suv ta'minoti",
    appliances_list: [
      { name: 'Muzlatgich',  w: '150',  n: '1', hrs: '24' },
      { name: 'Televizor',   w: '150',  n: '1', hrs: '5'  },
      { name: 'Konditsioner',w: '1500', n: '1', hrs: '8'  },
    ],
    apl1_name: 'Muzlatgich',   apl1_w: '150',  apl1_n: '1', apl1_hrs: '24',
    apl2_name: 'Televizor',    apl2_w: '150',  apl2_n: '1', apl2_hrs: '5',
    apl3_name: 'Konditsioner', apl3_w: '1500', apl3_n: '1', apl3_hrs: '8',
    floors_list: [{ l: '10', w: '10' }],
    floor_l1: '10', floor_w1: '10',
    doors_list: [{ w: '0.9', h: '2.1', n: '2' }],
    door_w1: '0.9', door_h1: '2.1', door_n1: '2',
    windows_list: [{ w: '1.2', h: '1.4', n: '4' }],
    win_w1: '1.2', win_h1: '1.4', win_n1: '4',
    walls_list: [{ p: '40', h: '2.7' }],
    wall_p1: '40', wall_h1: '2.7',
    ariston_count: '1', ariston_kW: '2', fes_kw: '10', grid: 'on-grid', gelio_l: '200',
    r1_temp: '22', r1_hum: '45', r1_lux: '300',
    r2_temp: '21', r2_hum: '48', r2_lux: '250',
    u1_temp: '21',
  };
}

export default function NewAuditScreen({ navigation, route }: any) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<any>({});
  const [isStarted, setIsStarted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState('');
  const [generateProgress, setGenerateProgress] = useState(0);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [successNotice, setSuccessNotice] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [syncError, setSyncError] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [allDrafts, setAllDrafts] = useState<AuditDraft[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editConsumedRef = useRef<string | null>(null);
  const tokenRef = useRef<string>('');

  // Scroll references for single-page layout
  const scrollViewRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef<Record<number, number>>({});
  const scrollToDraftStepRef = useRef<number | null>(null);

  const formDataRef = useRef(formData);
  const currentStepRef = useRef(currentStep);
  const isStartedRef = useRef(isStarted);
  useEffect(() => { formDataRef.current = formData; }, [formData]);
  useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);
  useEffect(() => { isStartedRef.current = isStarted; }, [isStarted]);

  useEffect(() => {
    AsyncStorage.getItem('auth_token').then(t => {
      if (t) tokenRef.current = t;
    });
  }, []);

  useEffect(() => {
    draftStorage.onSyncStatus(s => {
      setSyncError(s === 'failed');
    });
    return () => draftStorage.offSyncStatus();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if ((nextState === 'background' || nextState === 'inactive') && isStartedRef.current) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        draftStorage.save(formDataRef.current, currentStepRef.current);
        draftStorage.syncToServerNow(tokenRef.current, formDataRef.current, currentStepRef.current);
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  // Scroll to draft step after the form becomes visible and layouts settle
  useEffect(() => {
    if (!isStarted || scrollToDraftStepRef.current === null) return;
    const target = scrollToDraftStepRef.current;
    scrollToDraftStepRef.current = null;
    const t = setTimeout(() => {
      const offset = sectionOffsets.current[target];
      if (offset !== undefined && scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: offset, animated: false });
        setCurrentStep(target);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [isStarted]);

  // Handle edit mode from History
  useEffect(() => {
    const params = route?.params as any;
    if (!params?.editData) return;
    if (editConsumedRef.current === params.editCaseName) return;
    editConsumedRef.current = params.editCaseName;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const id = params.editData.draft_id || params.editData.case_number || `edit_${Date.now()}`;
    setFormData({ ...params.editData, draft_id: id });
    setCurrentStep(1);
    setIsStarted(true);
    setAllDrafts([]);
    navigation.setParams({ editData: null, editCaseName: null });
  }, [route?.params?.editData]);

  // Handle "Start Fresh" from Dashboard
  useEffect(() => {
    const params = route?.params as any;
    if (!params?.startFresh) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    draftStorage.clear();
    draftStorage.clearOnServer(tokenRef.current);
    editConsumedRef.current = null;
    setAllDrafts([]);
    navigation.setParams({ startFresh: null });
    fetch(`${BASE_URL}/next-case-number`)
      .then(r => r.json())
      .then(json => {
        const id = json.case_number || `draft_${Date.now()}`;
        setFormData({ ...buildDefaults(json.case_number), draft_id: id });
      })
      .catch(() => {
        const id = `draft_${Date.now()}`;
        setFormData({ ...buildDefaults(), draft_id: id });
      })
      .finally(() => {
        setCurrentStep(1);
        setIsStarted(true);
      });
  }, [route?.params?.startFresh]);

  // Handle resume of a specific draft from Drafts page
  useEffect(() => {
    const params = route?.params as any;
    if (!params?.resumeDraftId) return;
    navigation.setParams({ resumeDraftId: null });
    draftStorage.loadAll().then(drafts => {
      const draft = drafts.find(d => d.id === params.resumeDraftId);
      if (!draft) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      setFormData(draft.formData);
      setCurrentStep(draft.step);
      scrollToDraftStepRef.current = draft.step;
      setIsStarted(true);
    });
  }, [route?.params?.resumeDraftId]);

  // Load drafts silently whenever the welcome screen is visible
  useFocusEffect(
    useCallback(() => {
      const params = route?.params as any;
      if (params?.editData || params?.startFresh) return;
      if (isStarted) return;

      const checkDrafts = async () => {
        let drafts = await draftStorage.loadAll();
        if (!drafts.length && tokenRef.current) {
          const serverDraft = await draftStorage.loadFromServer(tokenRef.current);
          if (serverDraft) {
            await draftStorage.save(serverDraft.formData, serverDraft.step);
            drafts = [serverDraft];
          }
        }
        setAllDrafts(drafts);
      };
      checkDrafts();
    }, [isStarted])
  );

  const saveDraft = (data: any, step: number) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus('saving');
    saveTimerRef.current = setTimeout(async () => {
      await draftStorage.save(data, step);
      setSaveStatus('saved');
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
      saveStatusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 3000);
    }, 300);
    draftStorage.syncToServer(tokenRef.current, data, step);
  };

  // Jump to a specific step section
  const jumpToStep = (stepId: number) => {
    const offset = sectionOffsets.current[stepId];
    if (offset !== undefined && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: offset, animated: true });
    }
    setCurrentStep(stepId);
    saveDraft(formData, stepId);
  };

  // Update active step based on scroll position
  const handleScroll = (e: any) => {
    const y = e.nativeEvent.contentOffset.y;
    for (let i = steps.length; i >= 1; i--) {
      const off = sectionOffsets.current[i] ?? 0;
      if (y >= off - 100) {
        if (i !== currentStepRef.current) {
          setCurrentStep(i);
        }
        break;
      }
    }
  };

  // Resume an existing draft
  const handleResumeDraft = (draft: AuditDraft) => {
    setFormData(draft.formData);
    setCurrentStep(draft.step);
    scrollToDraftStepRef.current = draft.step;
    setIsStarted(true);
  };

  const doStartNew = () => {
    fetch(`${BASE_URL}/next-case-number`)
      .then(r => r.json())
      .then(json => {
        const id = json.case_number || `draft_${Date.now()}`;
        setFormData({ ...buildDefaults(json.case_number), draft_id: id });
      })
      .catch(() => {
        const id = `draft_${Date.now()}`;
        setFormData({ ...buildDefaults(), draft_id: id });
      })
      .finally(() => {
        setCurrentStep(1);
        setIsStarted(true);
      });
  };

  // Start new audit — multiple drafts coexist so no confirmation needed
  const handleStartNew = () => {
    doStartNew();
  };

  // Header exit button
  const handleHeaderExit = () => {
    Alert.alert(
      'Exit to Menu?',
      'Your progress is saved. You can resume from the main screen anytime.',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Exit',
          onPress: () => {
            draftStorage.save(formDataRef.current, currentStepRef.current);
            draftStorage.syncToServer(tokenRef.current, formDataRef.current, currentStepRef.current);
            editConsumedRef.current = null;
            setAllDrafts(prev => {
              const id = formDataRef.current.draft_id || formDataRef.current.case_number || 'draft';
              const existing = prev.filter(d => d.id !== id);
              return [{ id, formData: formDataRef.current, step: currentStepRef.current, savedAt: Date.now() }, ...existing];
            });
            setIsStarted(false);
          },
        },
      ]
    );
  };

  const updateFormData = (stepData: any) => {
    const newData = { ...formData, ...stepData };
    setFormData(newData);
    saveDraft(newData, currentStepRef.current);
  };

  const handleSubmit = async () => {
    setSubmitError('');

    const photoItems = formData.photoItems as Record<string, any[]> | undefined;
    if (photoItems) {
      const allPhotos = Object.values(photoItems).flat();
      const notReady = allPhotos.filter((p: any) =>
        !p.serverKey && !p.isExisting && !p.error
      );
      if (notReady.length > 0) {
        setSubmitError(`${notReady.length} photo(s) are still uploading. Please wait.`);
        return;
      }
    }

    setIsSubmitting(true);
    setElapsedSecs(0);
    setGenerateProgress(0);
    setSubmitProgress('Preparing submission…');

    elapsedTimerRef.current = setInterval(() => {
      setElapsedSecs(prev => prev + 1);
    }, 1000);

    try {
      const fd = new FormData();

      const skip = ['appliances_list', 'floors_list', 'doors_list', 'windows_list', 'walls_list', 'y2023', 'y2024', 'y2025', 'photos', 'photoItems'];
      Object.entries(formData).forEach(([key, value]) => {
        if (!skip.includes(key) && value !== undefined && value !== null && typeof value !== 'object') {
          fd.append(key, String(value));
        }
      });

      setSubmitProgress('Preparing energy data…');
      [2023, 2024, 2025].forEach(yr => {
        const yData: any = formData[`y${yr}`];
        if (yData && Array.isArray(yData)) {
          yData.forEach((m: any, mi: number) => {
            fd.append(`gas_${yr}_${mi}`, m.gas || '0');
            fd.append(`elec_${yr}_${mi}`, m.elec || '0');
            fd.append(`other_${yr}_${mi}`, m.other || '0');
          });
        } else {
          const gasList: any = formData[`gas_${yr}`];
          if (Array.isArray(gasList)) {
            for (let mi = 0; mi < 12; mi++) {
              fd.append(`gas_${yr}_${mi}`, String(gasList[mi] ?? 0));
              fd.append(`elec_${yr}_${mi}`, String((formData[`elec_${yr}`] as any[])?.[mi] ?? 0));
              fd.append(`other_${yr}_${mi}`, String((formData[`other_${yr}`] as any[])?.[mi] ?? 0));
            }
          }
        }
      });

      let photoCount = 0;
      if (photoItems) {
        for (const [sectionId, items] of Object.entries(photoItems)) {
          const secId = SECTION_SEC_ID[sectionId];
          if (!secId) continue;
          items.forEach((item: any, idx: number) => {
            if (item.serverKey) {
              fd.append(`photo_key_s${secId}_${idx + 1}`, item.serverKey);
              photoCount++;
            }
          });
        }
      }

      setSubmitProgress(`Generating reports with ${photoCount} photo(s)…`);

      const token = tokenRef.current || await AsyncStorage.getItem('auth_token') || '';

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${BASE_URL}/generate`);
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
        xhr.timeout = 180000;

        let lastParsedLength = 0;

        xhr.onprogress = () => {
          const text = xhr.responseText;
          if (text.length <= lastParsedLength) return;
          const newText = text.slice(lastParsedLength);
          lastParsedLength = text.length;
          const lines = newText.split('\n').filter(l => l.trim());
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.message) setSubmitProgress(parsed.message);
              if (typeof parsed.progress === 'number') setGenerateProgress(parsed.progress);
            } catch {
              // ignore malformed lines
            }
          }
        };

        xhr.onload = () => {
          // Parse the last JSON line for the final result
          const text = xhr.responseText;
          const lines = text.split('\n').filter(l => l.trim());
          let json: any = null;
          // Find the last line with done: true
          for (let i = lines.length - 1; i >= 0; i--) {
            try {
              const parsed = JSON.parse(lines[i]);
              if (parsed.done) {
                json = parsed;
                break;
              }
            } catch {
              // continue
            }
          }
          // Fallback: try last non-empty line
          if (!json && lines.length > 0) {
            try { json = JSON.parse(lines[lines.length - 1]); } catch { /* ignore */ }
          }

          if (!json) {
            reject(new Error(`Server error (HTTP ${xhr.status}). Please try again.`));
            return;
          }

          if (!json.success) {
            reject(new Error(json.error || `Submission failed (HTTP ${xhr.status})`));
            return;
          }

          const wasEdit = Boolean(formData.edit_case);
          draftStorage.clearById(formData.draft_id || formData.case_number || '');
          draftStorage.clearOnServer(tokenRef.current);
          if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
          setIsSubmitting(false);
          setSubmitProgress('');
          setGenerateProgress(0);
          setSuccessNotice(
            wasEdit
              ? `Audit "${json.case_name}" updated. Opening Folders...`
              : `Audit "${json.case_name}" created. Opening Folders...`
          );
          if (successTimerRef.current) clearTimeout(successTimerRef.current);
          successTimerRef.current = setTimeout(() => {
            setSuccessNotice('');
            editConsumedRef.current = null;
            setFormData({});
            setCurrentStep(1);
            setIsStarted(false);
            setAllDrafts([]);
            navigation.navigate('Folders');
          }, 2000);
          resolve();
        };

        xhr.onerror = () => {
          reject(new Error('Cannot reach server'));
        };

        xhr.ontimeout = () => {
          reject(new Error('Request timed out. Check your connection and try again.'));
        };

        xhr.send(fd);
      });
    } catch (err: any) {
      const msg = err.message || 'Cannot reach server';
      setSubmitError(msg);
    } finally {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      setIsSubmitting(false);
      setSubmitProgress('');
      setGenerateProgress(0);
    }
  };

  // ── Welcome / Hub screen ─────────────────────────────────────────────────
  if (!isStarted) {
    if (showDrafts) {
      return (
        <DraftsScreen
          onBack={() => setShowDrafts(false)}
          navigation={navigation}
          onResume={(draft) => {
            setShowDrafts(false);
            handleResumeDraft(draft);
          }}
        />
      );
    }

    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={[Colors.primaryDark, Colors.primary]} style={styles.welcomeHeader}>
          <Text style={styles.welcomeTitle}>New Energy Audit</Text>
          <Text style={styles.welcomeSubtitle}>Comprehensive energy assessment</Text>
        </LinearGradient>

        <ScrollView contentContainerStyle={styles.welcomeContent}>

          {allDrafts.length > 0 && (
            <View style={styles.draftsSection}>
              <View style={styles.draftsSectionHeader}>
                <Ionicons name="time-outline" size={16} color={Colors.orange} />
                <Text style={styles.draftsSectionTitle}>In Progress ({allDrafts.length})</Text>
              </View>
              {allDrafts.map(draft => {
                const stepName = steps.find(s => s.id === draft.step)?.name;
                const caseNum = draft.formData?.case_number as string | undefined;
                return (
                  <View key={draft.id} style={styles.draftCard}>
                    <View style={styles.draftCardLeft}>
                      <View style={styles.draftIconWrap}>
                        <Ionicons name="document-text-outline" size={18} color={Colors.orange} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.draftCaseNum}>{caseNum || draft.id}</Text>
                        <Text style={styles.draftMeta}>
                          Step {draft.step}/{steps.length} — {stepName} · {draftStorage.formatAge(draft.savedAt)}
                        </Text>
                        <View style={styles.draftProgressBarBg}>
                          <View style={[styles.draftProgressBarFill, { width: `${(draft.step / steps.length) * 100}%` as any }]} />
                        </View>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => handleResumeDraft(draft)} style={styles.draftResumeBtn} activeOpacity={0.8}>
                      <Ionicons name="play" size={14} color="#fff" />
                      <Text style={styles.draftResumeBtnText}>Resume</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}

          <TouchableOpacity onPress={handleStartNew} style={styles.startButton} activeOpacity={0.85}>
            <LinearGradient colors={[Colors.success, '#2D9249']} style={styles.startButtonGradient}>
              <Ionicons name="add-circle" size={24} color="#fff" />
              <Text style={styles.startButtonText}>Start New Energy Audit</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Folders')} style={styles.editExistingButton} activeOpacity={0.85}>
            <View style={styles.editExistingInner}>
              <Ionicons name="pencil-outline" size={20} color={Colors.primary} />
              <Text style={styles.editExistingText}>Edit Existing Case</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowDrafts(true)} style={styles.draftsButton} activeOpacity={0.85}>
            <View style={styles.draftsButtonInner}>
              <Ionicons name="document-text-outline" size={20} color={Colors.orange} />
              <Text style={styles.draftsButtonText}>Drafts</Text>
              {allDrafts.length > 0 && (
                <View style={styles.draftsButtonBadge}>
                  <Text style={styles.draftsButtonBadgeText}>{allDrafts.length}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          <View style={styles.stepsCard}>
            <View style={styles.stepsCardHeader}>
              <Ionicons name="list-outline" size={18} color={Colors.primary} />
              <Text style={styles.stepsCardTitle}>{steps.length} steps in this form</Text>
            </View>
            <View style={styles.stepsChipsRow}>
              {steps.map(s => (
                <View key={s.id} style={styles.stepChipSmall}>
                  <Text style={styles.stepChipSmallNum}>{s.id}</Text>
                  <Text style={styles.stepChipSmallName}>{s.name}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.autoSaveNote}>
            <Ionicons name="cloud-done-outline" size={15} color={Colors.textMuted} />
            <Text style={styles.autoSaveNoteText}>
              Progress is saved automatically to the server in real time
            </Text>
          </View>

        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Active audit wizard — single-page scroll ─────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      {/* Compact gradient header with step dot nav */}
      <LinearGradient colors={[Colors.primaryDark, Colors.primary]} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={handleHeaderExit} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginHorizontal: 8 }}>
            <Text style={styles.headerTitle}>
              {formData.edit_case ? 'Edit Audit' : 'New Audit'}
            </Text>
            <Text style={styles.headerStepLabel}>
              {syncError ? '⚠ Sync failed, retrying… · ' : saveStatus === 'saving' ? '● Saving… · ' : saveStatus === 'saved' ? '✓ Saved · ' : ''}
              Step {currentStep} — {steps.find(s => s.id === currentStep)?.name}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleSubmit}
            style={styles.submitHeaderBtn}
            disabled={isSubmitting}
            activeOpacity={0.75}
          >
            <Ionicons name="checkmark-circle" size={16} color="#fff" />
            <Text style={styles.submitHeaderBtnText}>Submit</Text>
          </TouchableOpacity>
        </View>

        {/* Small step dots — tap to jump to section */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stepDotsRow}
        >
          {steps.map(step => {
            const isActive = step.id === currentStep;
            const isComplete = step.id < currentStep;
            return (
              <TouchableOpacity
                key={step.id}
                onPress={() => jumpToStep(step.id)}
                style={styles.stepDotWrap}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.stepDot,
                  isComplete && styles.stepDotDone,
                  isActive && styles.stepDotActive,
                ]}>
                  {isComplete
                    ? <Ionicons name="checkmark" size={9} color="#fff" />
                    : <Text style={[styles.stepDotNum, isActive && styles.stepDotNumActive]}>{step.id}</Text>
                  }
                </View>
                {isActive && (
                  <Text style={styles.stepDotName} numberOfLines={1}>{step.name}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </LinearGradient>

      {/* Single scrollable page — all steps inline */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.content}
        onScroll={handleScroll}
        scrollEventThrottle={50}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {steps.map(step => (
          <View key={step.id}>
            {/* Step divider / section header */}
            <View
              style={styles.stepDivider}
              onLayout={e => { sectionOffsets.current[step.id] = e.nativeEvent.layout.y; }}
            >
              <View style={styles.dividerLine} />
              <View style={styles.dividerBadge}>
                <View style={styles.dividerCircle}>
                  <Text style={styles.dividerNum}>{step.id}</Text>
                </View>
                <Text style={styles.dividerName}>{step.name}</Text>
              </View>
              <View style={styles.dividerLine} />
            </View>

            {/* Step content */}
            <View style={styles.stepContent}>
              <step.component
                data={formData}
                updateData={updateFormData}
                onNext={() => {}}
                onPrev={() => {}}
                embedded={true}
              />
            </View>
          </View>
        ))}

        {/* Submit section at the very bottom */}
        <View style={styles.submitSection}>
          {submitError ? (
            <View style={styles.submitErrorBar}>
              <Ionicons name="alert-circle" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.submitErrorText}>{submitError}</Text>
              <TouchableOpacity onPress={() => setSubmitError('')}>
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={handleSubmit}
            style={styles.submitBtn}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            <LinearGradient colors={[Colors.success, '#2D9249']} style={styles.submitBtnInner}>
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.submitBtnText}>
                {formData.edit_case ? 'Update Audit' : 'Submit Audit'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={isSubmitting} transparent animationType="fade">
        <View style={styles.overlayBg}>
          <View style={styles.overlayCard}>
            <ActivityIndicator size="large" color={Colors.success} />
            <Text style={styles.overlayTitle}>Generating Reports…</Text>
            {generateProgress > 0 && (
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${generateProgress}%` as any }]} />
              </View>
            )}
            <Text style={styles.overlayProgress}>{submitProgress}</Text>
            <Text style={styles.overlayElapsed}>{elapsedSecs}s elapsed</Text>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(successNotice)} transparent animationType="fade">
        <View style={styles.overlayBg}>
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={42} color={Colors.success} />
            <Text style={styles.successTitle}>Saved</Text>
            <Text style={styles.successText}>{successNotice}</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // ── Welcome / Hub screen ───────────────────────────────────────────────────
  welcomeHeader: {
    paddingTop: 60,
    paddingBottom: 36,
    paddingHorizontal: Space.xl,
    borderBottomLeftRadius: Radius.xxl,
    borderBottomRightRadius: Radius.xxl,
  },
  welcomeTitle: { fontSize: 28, fontWeight: '700', color: Colors.white, letterSpacing: 0.2 },
  welcomeSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.65)', marginTop: 6 },
  welcomeContent: { padding: Space.xl, paddingTop: Space.xxl, gap: Space.md },

  // Multi-draft section
  draftsSection: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    padding: Space.lg, gap: Space.sm, ...Shadow.sm,
    borderWidth: 1.5, borderColor: Colors.orange,
  },
  draftsSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  draftsSectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.orange },
  draftCard: {
    flexDirection: 'row', alignItems: 'center', gap: Space.md,
    backgroundColor: Colors.orangeLight,
    borderRadius: Radius.lg, padding: 12,
  },
  draftCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  draftIconWrap: {
    width: 36, height: 36, borderRadius: Radius.sm,
    backgroundColor: 'rgba(234,88,12,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  draftCaseNum: { fontSize: 13, fontWeight: '700', color: Colors.text },
  draftMeta: { fontSize: 11, color: Colors.textMuted, marginTop: 2, marginBottom: 4 },
  draftProgressBarBg: { height: 3, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 2, overflow: 'hidden' },
  draftProgressBarFill: { height: 3, backgroundColor: Colors.orange, borderRadius: 2 },
  draftResumeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.orange, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.md,
  },
  draftResumeBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  startButton: { borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.md },
  startButtonGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 18, gap: 10,
  },
  startButtonText: { color: Colors.white, fontSize: 17, fontWeight: '700' },

  editExistingButton: {
    borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.primary,
    overflow: 'hidden', ...Shadow.sm,
  },
  editExistingInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, gap: 10, backgroundColor: Colors.primaryLight,
  },
  editExistingText: { color: Colors.primary, fontSize: 16, fontWeight: '700' },

  draftsButton: {
    borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.orange,
    overflow: 'hidden', ...Shadow.sm,
  },
  draftsButtonInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, gap: 10, backgroundColor: Colors.orangeLight,
  },
  draftsButtonText: { color: Colors.orange, fontSize: 16, fontWeight: '700' },
  draftsButtonBadge: {
    backgroundColor: Colors.orange,
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  draftsButtonBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.white },

  stepsCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    padding: Space.xl, gap: Space.md, ...Shadow.sm,
  },
  stepsCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepsCardTitle: { fontSize: 14, fontWeight: '600', color: Colors.textSec },
  stepsChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  stepChipSmall: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm,
  },
  stepChipSmallNum: { fontSize: 10, fontWeight: '700', color: Colors.primary },
  stepChipSmallName: { fontSize: 11, color: Colors.primary, fontWeight: '500' },

  autoSaveNote: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    justifyContent: 'center', paddingVertical: Space.xs,
  },
  autoSaveNoteText: { fontSize: 12, color: Colors.textMuted },

  // ── Compact wizard header ──────────────────────────────────────────────────
  header: { paddingTop: 8, paddingBottom: 10, paddingHorizontal: Space.lg },
  headerTop: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 10,
  },
  backButton: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  headerTitle: { fontSize: 15, fontWeight: '700', color: Colors.white },
  headerStepLabel: { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 1 },
  // Submit button in header
  submitHeaderBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.success,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: Radius.md,
  },
  submitHeaderBtnText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  // Step dots navigation
  stepDotsRow: { paddingLeft: 2, paddingRight: 8, gap: 6, alignItems: 'center', paddingVertical: 2 },
  stepDotWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stepDot: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  stepDotDone: { backgroundColor: Colors.success, borderColor: Colors.success },
  stepDotActive: { backgroundColor: Colors.white, borderColor: Colors.white },
  stepDotNum: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  stepDotNumActive: { color: Colors.primary },
  stepDotName: { fontSize: 11, color: Colors.white, fontWeight: '600', maxWidth: 72 },

  // ── Single-page content ────────────────────────────────────────────────────
  content: { flex: 1, backgroundColor: Colors.bg },

  stepDivider: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Space.lg, paddingTop: 20, paddingBottom: 12,
  },
  dividerLine: { flex: 1, height: 1.5, backgroundColor: Colors.border },
  dividerBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10 },
  dividerCircle: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  dividerNum: { fontSize: 11, fontWeight: '700', color: '#fff' },
  dividerName: { fontSize: 13, fontWeight: '600', color: Colors.textSec },

  stepContent: { paddingHorizontal: Space.lg },

  // Submit section
  submitSection: { paddingHorizontal: Space.lg, paddingTop: Space.xl, paddingBottom: Space.xxl },
  submitBtn: { borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.md },
  submitBtnInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 18, gap: 10,
  },
  submitBtnText: { color: Colors.white, fontSize: 17, fontWeight: '700' },
  submitErrorBar: {
    backgroundColor: Colors.danger,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Space.lg, paddingVertical: Space.md,
    borderRadius: Radius.md, marginBottom: Space.md,
  },
  submitErrorText: { color: Colors.white, fontSize: 14, fontWeight: '600', flex: 1 },

  // ── Modals ─────────────────────────────────────────────────────────────────
  overlayBg: {
    flex: 1, backgroundColor: Colors.overlay,
    justifyContent: 'center', alignItems: 'center', padding: Space.xxxl,
  },
  overlayCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    padding: Space.xxxl, alignItems: 'center', gap: Space.md,
    width: '100%', ...Shadow.lg,
  },
  overlayTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginTop: Space.sm },
  progressBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    backgroundColor: Colors.success,
    borderRadius: Radius.pill,
  },
  overlayProgress: { fontSize: 14, color: Colors.textSec, textAlign: 'center' },
  overlayElapsed: { fontSize: 13, color: Colors.success, fontWeight: '600' },
  successCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    padding: 28, alignItems: 'center', gap: Space.md,
    width: '100%', ...Shadow.lg,
  },
  successTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  successText: { fontSize: 14, color: Colors.textSec, textAlign: 'center', lineHeight: 20 },
});
