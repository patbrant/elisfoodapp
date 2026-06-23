import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  createComponent,
  listFavorites,
  listRecent,
  search,
  toggleFavorite,
  touchLastUsed,
} from '../services/componentService';
import type { Component, DeliveryForm } from '../domain/types';
import { colors, radius } from './theme';

type Props = {
  visible: boolean;
  onSelect: (component: Component, form: DeliveryForm | null) => void;
  onClose: () => void;
};

export function ComponentPicker({ visible, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState<Component[]>([]);
  const [recent, setRecent] = useState<Component[]>([]);
  const [results, setResults] = useState<Component[]>([]);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<'search' | 'pickForm'>('search');
  const [pendingComponent, setPendingComponent] = useState<Component | null>(null);
  const creatingRef = useRef(false);

  const reloadDefaults = useCallback(async () => {
    const [favs, rec] = await Promise.all([listFavorites(), listRecent()]);
    setFavorites(favs);
    setRecent(rec);
  }, []);

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setResults([]);
    setStep('search');
    setPendingComponent(null);
    creatingRef.current = false;
    reloadDefaults();
  }, [visible, reloadDefaults]);

  useEffect(() => {
    if (!visible) return;
    if (query.trim().length === 0) {
      setResults([]);
      return;
    }
    let cancelled = false;
    search(query).then((r) => {
      if (!cancelled) setResults(r);
    });
    return () => {
      cancelled = true;
    };
  }, [query, visible]);

  const openFormPicker = (component: Component) => {
    setPendingComponent(component);
    setStep('pickForm');
  };

  const handleSelect = async (component: Component) => {
    if (busy) return;
    setBusy(true);
    try {
      await touchLastUsed(component.id);
      openFormPicker(component);
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    if (creatingRef.current) return;
    const name = query.trim();
    if (name.length === 0) return;
    creatingRef.current = true;
    try {
      const component = await createComponent(name);
      await touchLastUsed(component.id);
      openFormPicker({ ...component, lastUsedAt: new Date().toISOString() });
    } finally {
      creatingRef.current = false;
    }
  };

  const handleFormPick = (form: DeliveryForm | null) => {
    if (!pendingComponent) return;
    onSelect(pendingComponent, form);
  };

  const handleToggleFavorite = async (id: string) => {
    await toggleFavorite(id);
    await reloadDefaults();
    if (query.trim().length > 0) {
      const r = await search(query);
      setResults(r);
    }
  };

  const trimmedQuery = query.trim();
  const hasExactMatch = trimmedQuery.length > 0
    && results.some((c) => c.name.toLowerCase() === trimmedQuery.toLowerCase());
  const showCreate = trimmedQuery.length > 0 && !hasExactMatch;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {step === 'search' ? 'Komponente wählen' : 'Verabreichungsform'}
          </Text>
          <Pressable
            onPress={step === 'pickForm' ? () => setStep('search') : onClose}
            hitSlop={10}
          >
            <Text style={styles.closeText}>
              {step === 'pickForm' ? 'Zurück' : 'Schliessen'}
            </Text>
          </Pressable>
        </View>

        {step === 'search' ? (
          <>
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Suche oder neuen Namen eintippen"
              placeholderTextColor={colors.textMuted}
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
            />
            <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
              {trimmedQuery.length === 0 ? (
                <>
                  <Section title="Favoriten" empty="Keine Favoriten.">
                    {favorites.map((c) => (
                      <ComponentRow
                        key={c.id}
                        component={c}
                        onSelect={handleSelect}
                        onToggleFavorite={handleToggleFavorite}
                      />
                    ))}
                  </Section>
                  <Section title="Zuletzt verwendet" empty="Noch nichts verwendet.">
                    {recent.map((c) => (
                      <ComponentRow
                        key={c.id}
                        component={c}
                        onSelect={handleSelect}
                        onToggleFavorite={handleToggleFavorite}
                      />
                    ))}
                  </Section>
                </>
              ) : (
                <Section title="Treffer" empty="Keine Treffer.">
                  {results.map((c) => (
                    <ComponentRow
                      key={c.id}
                      component={c}
                      onSelect={handleSelect}
                      onToggleFavorite={handleToggleFavorite}
                    />
                  ))}
                </Section>
              )}

              {showCreate ? (
                <View style={styles.createBox}>
                  <Pressable style={styles.createButton} onPress={handleCreate}>
                    <Text style={styles.createButtonText}>+ Anlegen "{trimmedQuery}"</Text>
                  </Pressable>
                </View>
              ) : null}
            </ScrollView>
          </>
        ) : (
          <View style={styles.formPickerBody}>
            <Text style={styles.formPickerLabel}>{pendingComponent?.name}</Text>
            <Text style={styles.formPickerHint}>Wie wird diese Komponente verabreicht?</Text>
            <Pressable style={styles.formButton} onPress={() => handleFormPick('flasche')}>
              <Text style={styles.formButtonText}>Flasche</Text>
            </Pressable>
            <Pressable style={styles.formButton} onPress={() => handleFormPick('sondomat')}>
              <Text style={styles.formButtonText}>Sondomat</Text>
            </Pressable>
            <Pressable style={styles.formButton} onPress={() => handleFormPick('spritze')}>
              <Text style={styles.formButtonText}>Spritze</Text>
            </Pressable>
            <Pressable
              style={[styles.formButton, styles.formButtonNeutral]}
              onPress={() => handleFormPick(null)}
            >
              <Text style={[styles.formButtonText, styles.formButtonNeutralText]}>Ohne Angabe</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const childArray = Array.isArray(children) ? children : [children];
  const hasChildren = childArray.some((c) => c !== null && c !== undefined && c !== false);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {hasChildren ? children : <Text style={styles.sectionEmpty}>{empty}</Text>}
    </View>
  );
}

function ComponentRow({
  component,
  onSelect,
  onToggleFavorite,
}: {
  component: Component;
  onSelect: (c: Component) => void;
  onToggleFavorite: (id: string) => void;
}) {
  return (
    <View style={styles.rowOuter}>
      <Pressable
        style={({ pressed }) => [styles.rowInner, pressed && styles.rowPressed]}
        onPress={() => onSelect(component)}
      >
        <Text style={styles.rowName} numberOfLines={1}>
          {component.name}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => onToggleFavorite(component.id)}
        style={styles.starButton}
        hitSlop={8}
      >
        <Text style={[styles.star, component.isFavorite && styles.starActive]}>
          {component.isFavorite ? '★' : '☆'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  closeText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '500',
  },
  searchInput: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  body: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  sectionEmpty: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  rowOuter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  rowInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  rowPressed: {
    backgroundColor: colors.surfaceAlt,
  },
  rowName: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  starButton: {
    padding: 8,
  },
  star: {
    fontSize: 20,
    color: colors.starInactive,
  },
  starActive: {
    color: colors.starActive,
  },
  createBox: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: colors.primary,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  formPickerBody: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    gap: 12,
  },
  formPickerLabel: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  formPickerHint: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  formButton: {
    backgroundColor: colors.primary,
    paddingVertical: 15,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  formButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  formButtonNeutral: {
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  formButtonNeutralText: {
    color: colors.textSecondary,
  },
});
