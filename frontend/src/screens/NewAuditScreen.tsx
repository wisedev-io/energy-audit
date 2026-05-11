import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, SafeAreaView, Alert, Modal, ActivityIndicator, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
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
import { draftStorage } from '../utils/draftStorage';

const BASE_URL = 'http://157.180.28.98:5050';

const steps = [
  { id: 1, name: 'Basic Info',   component: BasicInfo },
  { id: 2, name: 'Building',     component: BuildingInfo },
  { id: 3, name: 'Systems',      component: SystemsEquipment },
  { id: 4, name: 'Appliances',   component: MainAppliances },
  { id: 5, name: 'Dimensions',   component: Dimensions },
  { id: 6, name: 'Energy Data',  component: EnergyConsumption },
  { id: 7, name: 'Boiler/Solar', component: BoilerSolar },
  { id: 8, name: 'Measurements', component: Measurements },
  { id: 9, name: 'Photos',       component: Photos },
  { id: 10, name: 'Review',      component: Review },
];

export default function NewAuditScreen({ navigation, route }: any) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<any>({});
  const [isStarted, setIsStarted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState('');
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [successNotice, setSuccessNotice] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [submitError, setSubmitError] = useState('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editConsumedRef = useRef<string | null>(null);
  const tokenRef = useRef<string>('');
  const draftPromptShownRef = useRef(false);

  // Refs for AppState background save (avoids stale closures)
  const formDataRef = useRef(formData);
  const currentStepRef = useRef(currentStep);
  const isStartedRef = useRef(isStarted);
  useEffect(() => { formDataRef.current = formData; }, [formData]);
  useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);
  useEffect(() => { isStartedRef.current = isStarted; }, [isStarted]);

  // Load auth token once on mount
  useEffect(() => {
    AsyncStorage.getItem('auth_token').then(t => {
      if (t) tokenRef.current = t;
    });
  }, []);

  // Save draft immediately when app goes to background or becomes inactive
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

  // Handle edit mode when navigated from History with case data
  useEffect(() => {
    const params = route?.params as any;
    if (!params?.editData) return;
    if (editConsumedRef.current === params.editCaseName) return;
    editConsumedRef.current = params.editCaseName;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setFormData(params.editData);
    setCurrentStep(1);
    setIsStarted(true);
    navigation.setParams({ editData: null, editCaseName: null });
  }, [route?.params?.editData]);

  // Handle "Start Fresh" navigation from Dashboard — clears draft and jumps to step 1
  useEffect(() => {
    const params = route?.params as any;
    if (!params?.startFresh) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    draftStorage.clear();
    draftStorage.clearOnServer(tokenRef.current);
    draftPromptShownRef.current = true;
    editConsumedRef.current = null;
    navigation.setParams({ startFresh: null });
    fetch(`${BASE_URL}/next-case-number`)
      .then(r => r.json())
      .then(json => {
        setFormData(json.case_number ? { case_number: json.case_number } : {});
      })
      .catch(() => setFormData({}))
      .finally(() => {
        setCurrentStep(1);
        setIsStarted(true);
      });
  }, [route?.params?.startFresh]);

  // Show "Continue Draft?" when tab comes into focus and form is idle
  useFocusEffect(
    useCallback(() => {
      const params = route?.params as any;
      if (params?.editData || params?.startFresh) return;
      if (isStarted) return;
      if (draftPromptShownRef.current) return;
      draftPromptShownRef.current = true;

      const checkDraft = async () => {
        let draft = await draftStorage.load();
        if (!draft && tokenRef.current) {
          draft = await draftStorage.loadFromServer(tokenRef.current);
          if (draft) await draftStorage.save(draft.formData, draft.step);
        }
        if (!draft) return;
        Alert.alert(
          'Continue Draft?',
          `You have an unsaved draft from ${draftStorage.formatAge(draft.savedAt)}. Continue where you left off?`,
          [
            {
              text: 'Start Fresh',
              style: 'destructive',
              onPress: () => {
                draftStorage.clear();
                draftStorage.clearOnServer(tokenRef.current);
              },
            },
            {
              text: 'Resume',
              onPress: () => {
                setFormData(draft!.formData);
                setCurrentStep(draft!.step);
                setIsStarted(true);
              },
            },
          ],
          { cancelable: false }
        );
      };
      checkDraft();
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

  const CurrentStepComponent = steps.find(s => s.id === currentStep)?.component || BasicInfo;
  const isLastStep = currentStep === steps.length;

  const handleStartNew = () => {
    fetch(`${BASE_URL}/next-case-number`)
      .then(r => r.json())
      .then(json => {
        setFormData(json.case_number ? { case_number: json.case_number } : {});
      })
      .catch(() => setFormData({}))
      .finally(() => {
        setCurrentStep(1);
        setIsStarted(true);
      });
  };

  const handleJumpToStep = (targetStep: number) => {
    setCurrentStep(targetStep);
    saveDraft(formData, targetStep);
  };

  const handleNext = () => {
    if (currentStep < steps.length) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      saveDraft(formData, nextStep);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      saveDraft(formData, prevStep);
    } else {
      editConsumedRef.current = null;
      setIsStarted(false);
      draftPromptShownRef.current = false;
    }
  };

  const updateFormData = (stepData: any) => {
    const newData = { ...formData, ...stepData };
    setFormData(newData);
    saveDraft(newData, currentStep);
  };

  const handleSubmit = async () => {
    console.log('handleSubmit called, formData keys:', Object.keys(formData));
    setSubmitError('');

    const photoItems = formData.photoItems as Record<string, any[]> | undefined;
    if (photoItems) {
      const uploading = Object.values(photoItems).flat().filter((p: any) => p.uploading);
      if (uploading.length > 0) {
        setSubmitError(`${uploading.length} photo(s) are still uploading. Please wait.`);
        return;
      }
    }

    setIsSubmitting(true);
    setElapsedSecs(0);
    setSubmitProgress('Preparing submission…');

    elapsedTimerRef.current = setInterval(() => {
      setElapsedSecs(prev => prev + 1);
    }, 1000);

    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), 180000); // 3-min timeout

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
      const response = await fetch(`${BASE_URL}/generate`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: fd,
        signal: controller.signal,
      });
      clearTimeout(abortTimer);

      console.log('Server response status:', response.status);
      let json: any;
      try {
        json = await response.json();
      } catch {
        throw new Error(`Server error (HTTP ${response.status}). Please try again.`);
      }
      console.log('Server response json:', JSON.stringify(json));

      if (!json.success) {
        console.error('Server error:', json.error);
        throw new Error(json.error || `Submission failed (HTTP ${response.status})`);
      }

      const wasEdit = Boolean(formData.edit_case);
      draftStorage.clear();
      draftStorage.clearOnServer(tokenRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      setIsSubmitting(false);
      setSubmitProgress('');
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
        draftPromptShownRef.current = false;
        navigation.navigate('Folders');
      }, 2000);
    } catch (err: any) {
      clearTimeout(abortTimer);
      console.error('Submit error:', err);
      const msg = err.name === 'AbortError'
        ? 'Request timed out. Check your connection and try again.'
        : (err.message || 'Cannot reach server');
      setSubmitError(msg);
    } finally {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      setIsSubmitting(false);
      setSubmitProgress('');
    }
  };

  // ── Welcome screen ───────────────────────────────────────────────────────
  if (!isStarted) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={['#2563eb', '#1d4ed8']} style={styles.welcomeHeader}>
          <Text style={styles.welcomeTitle}>New Energy Audit</Text>
          <Text style={styles.welcomeSubtitle}>Comprehensive energy assessment</Text>
        </LinearGradient>
        <ScrollView contentContainerStyle={styles.welcomeContent}>
          <View style={styles.welcomeCard}>
            <View style={styles.welcomeIconWrap}>
              <Ionicons name="flash" size={40} color="#2563eb" />
            </View>
            <Text style={styles.welcomeCardTitle}>Ready to begin?</Text>
            <Text style={styles.welcomeCardText}>
              This form guides you through {steps.length} steps to complete a full energy audit
              report. Your progress is saved automatically — locally and on the server.
            </Text>
            <View style={styles.welcomeStepsRow}>
              {steps.slice(0, 6).map(s => (
                <View key={s.id} style={styles.welcomeStepChip}>
                  <Text style={styles.welcomeStepChipText}>{s.name}</Text>
                </View>
              ))}
              <View style={styles.welcomeStepChip}>
                <Text style={styles.welcomeStepChipText}>+{steps.length - 6} more</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity onPress={handleStartNew} style={styles.startButton}>
            <LinearGradient colors={['#10b981', '#059669']} style={styles.startButtonGradient}>
              <Ionicons name="add-circle" size={24} color="#fff" />
              <Text style={styles.startButtonText}>Start New Energy Audit</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Folders')} style={styles.editExistingButton}>
            <View style={styles.editExistingInner}>
              <Ionicons name="pencil" size={20} color="#2563eb" />
              <Text style={styles.editExistingText}>Edit Existing Case</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.autoSaveNote}>
            <Ionicons name="cloud-done-outline" size={16} color="#6b7280" />
            <Text style={styles.autoSaveNoteText}>
              Progress is automatically saved to the server in real time
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Active audit wizard ──────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#2563eb', '#1d4ed8']} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={handlePrev} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {formData.edit_case ? 'Edit Energy Audit' : 'New Energy Audit'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Tappable step navigator — tap any chip to jump directly to that step */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.stepScroll}
          contentContainerStyle={styles.stepScrollContent}
        >
          {steps.map((step) => {
            const isComplete = step.id < currentStep;
            const isActive = step.id === currentStep;
            return (
              <TouchableOpacity
                key={step.id}
                onPress={() => handleJumpToStep(step.id)}
                style={styles.stepChip}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.stepCircle,
                  isComplete && styles.stepCircleComplete,
                  isActive && styles.stepCircleActive,
                ]}>
                  {isComplete
                    ? <Ionicons name="checkmark" size={11} color="#fff" />
                    : <Text style={[styles.stepCircleText, isActive && styles.stepCircleTextActive]}>{step.id}</Text>
                  }
                </View>
                <Text
                  style={[styles.stepChipLabel, isActive && styles.stepChipLabelActive]}
                  numberOfLines={1}
                >
                  {step.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.progressInfo}>
          <Text style={styles.progressText}>Step {currentStep} of {steps.length}</Text>
          {saveStatus === 'saving' ? (
            <Text style={styles.saveStatusText}>Saving…</Text>
          ) : saveStatus === 'saved' ? (
            <Text style={styles.saveStatusText}>✓ Draft saved</Text>
          ) : (
            <Text style={styles.progressText}>{steps.find(s => s.id === currentStep)?.name}</Text>
          )}
        </View>
      </LinearGradient>

      <ScrollView style={styles.content}>
        <CurrentStepComponent
          data={formData}
          updateData={updateFormData}
          onNext={handleNext}
          onPrev={handlePrev}
        />
      </ScrollView>

      <View style={styles.navigation}>
        <TouchableOpacity onPress={handlePrev} style={[styles.navButton, styles.prevButton]}>
          <Text style={styles.prevButtonText}>{currentStep === 1 ? 'Back' : 'Previous'}</Text>
        </TouchableOpacity>

        {isLastStep ? (
          <TouchableOpacity onPress={handleSubmit} style={[styles.navButton, styles.submitButton]} disabled={isSubmitting}>
            <View style={styles.submitButtonInner}>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.nextButtonText}>
                {formData.edit_case ? 'Update' : 'Submit'}
              </Text>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleNext} style={styles.navButton}>
            <LinearGradient colors={['#2563eb', '#1d4ed8']} style={styles.nextButtonGradient}>
              <Text style={styles.nextButtonText}>Next</Text>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>

      {/* Visible error banner (Alert.alert is silent on web) */}
      {submitError ? (
        <View style={styles.submitErrorBar}>
          <Ionicons name="alert-circle" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.submitErrorText}>{submitError}</Text>
          <TouchableOpacity onPress={() => setSubmitError('')}>
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Submitting overlay */}
      <Modal visible={isSubmitting} transparent animationType="fade">
        <View style={styles.overlayBg}>
          <View style={styles.overlayCard}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={styles.overlayTitle}>Generating Reports…</Text>
            <Text style={styles.overlayProgress}>{submitProgress}</Text>
            <Text style={styles.overlayElapsed}>{elapsedSecs}s elapsed</Text>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(successNotice)} transparent animationType="fade">
        <View style={styles.overlayBg}>
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={42} color="#10b981" />
            <Text style={styles.successTitle}>Saved</Text>
            <Text style={styles.successText}>{successNotice}</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },

  // Welcome screen
  welcomeHeader: {
    paddingTop: 60,
    paddingBottom: 28,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  welcomeTitle: { fontSize: 26, fontWeight: '700', color: '#fff' },
  welcomeSubtitle: { fontSize: 14, color: '#bfdbfe', marginTop: 4 },
  welcomeContent: { padding: 20, gap: 16 },
  welcomeCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    elevation: 3,
    gap: 12,
  },
  welcomeIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeCardTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  welcomeCardText: { fontSize: 14, color: '#6b7280', lineHeight: 22 },
  welcomeStepsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  welcomeStepChip: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  welcomeStepChipText: { fontSize: 11, color: '#1d4ed8', fontWeight: '600' },
  startButton: { borderRadius: 16, overflow: 'hidden', elevation: 4 },
  startButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  startButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  editExistingButton: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#2563eb',
    overflow: 'hidden',
  },
  editExistingInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
    backgroundColor: '#eff6ff',
  },
  editExistingText: { color: '#2563eb', fontSize: 17, fontWeight: '700' },
  autoSaveNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  autoSaveNoteText: { fontSize: 12, color: '#9ca3af' },

  // Audit wizard
  header: { paddingTop: 8, paddingBottom: 12, paddingHorizontal: 16 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },

  // Step navigator
  stepScroll: { marginBottom: 8 },
  stepScrollContent: { paddingRight: 8, gap: 6 },
  stepChip: { alignItems: 'center', marginRight: 6, minWidth: 48 },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  stepCircleComplete: { backgroundColor: '#10b981' },
  stepCircleActive: { backgroundColor: '#fff' },
  stepCircleText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.8)' },
  stepCircleTextActive: { color: '#2563eb' },
  stepChipLabel: { fontSize: 9, color: 'rgba(255,255,255,0.6)', textAlign: 'center', maxWidth: 52 },
  stepChipLabelActive: { color: '#fff', fontWeight: '700' },

  progressInfo: { flexDirection: 'row', justifyContent: 'space-between' },
  progressText: { fontSize: 12, color: '#bfdbfe' },
  saveStatusText: { fontSize: 12, color: '#a7f3d0', fontWeight: '600' },
  content: { flex: 1, padding: 16 },
  navigation: { flexDirection: 'row', padding: 16, gap: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  navButton: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  prevButton: { backgroundColor: '#f3f4f6' },
  prevButtonText: { textAlign: 'center', paddingVertical: 14, fontSize: 16, fontWeight: '600', color: '#374151' },
  nextButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 4 },
  nextButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  submitButton: { backgroundColor: '#10b981' },
  submitButtonInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  submitErrorBar: {
    backgroundColor: '#ef4444',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  submitErrorText: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },
  overlayBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  overlayCard: { backgroundColor: '#fff', borderRadius: 20, padding: 32, alignItems: 'center', gap: 12, width: '100%' },
  overlayTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginTop: 8 },
  overlayProgress: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  overlayElapsed: { fontSize: 13, color: '#10b981', fontWeight: '600' },
  successCard: { backgroundColor: '#fff', borderRadius: 20, padding: 28, alignItems: 'center', gap: 10, width: '100%' },
  successTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  successText: { fontSize: 14, color: '#4b5563', textAlign: 'center', lineHeight: 20 },
});
