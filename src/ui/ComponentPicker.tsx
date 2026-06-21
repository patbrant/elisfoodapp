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
import { DeliveryBadge } from './DeliveryBadge';

type Props = {
  visible: boolean;
  onSelect: (component: Component) => void;
  onClose: () => void;
  excludeIds?: string[];
};

export function ComponentPicker({ visible, onSelect, onClose, excludeIds }: Props) {
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState<Component[]>([]);
  const [recent, setRecent] = useState<Component[]>([]);
  const [results, setResults] = useState<Component[]>([]);
  const [busy, setBusy] = useState(false);
  const creatingRef = useRef(false);

  const exclude = useCallback(
    (list: Component[]) => (excludeIds && excludeIds.length > 0
      ? list.filter((c) => !excludeIds.includes(c.id))
      : list),
    [excludeIds],
  );

  const reloadDefaults = useCallback(async () => {
    const [favs, rec] = await Promise.all([listFavorites(), listRecent()]);
    setFavorites(favs);
    setRecent(rec);
  }, []);

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setResults([]);
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

  const handleSelect = async (component: Component) => {
    if (busy) return;
    setBusy(true);
    try {
      await touchLastUsed(component.id);
      onSelect(component);
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async (form: DeliveryForm | null) => {
    if (creatingRef.current) return;
    const name = query.trim();
    if (name.length === 0) return;
    creatingRef.current = true;
    try {
      const component = await createComponent(name, form);
      await touchLastUsed(component.id);
      onSelect({ ...component, lastUsedAt: new Date().toISOString() });
    } finally {
      creatingRef.current = false;
    }
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

  const filteredResults = exclude(results);
  const filteredFavorites = exclude(favorites);
  const filteredRecent = exclude(recent);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Komponente wählen</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.closeText}>Schliessen</Text>
          </Pressable>
        </View>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Suche oder neuen Namen eintippen"
          placeholderTextColor="#888"
          autoFocus
          autoCorrect={false}
          autoCapitalize="none"
        />
        <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
          {trimmedQuery.length === 0 ? (
            <>
              <Section title="Favoriten" empty="Keine Favoriten.">
                {filteredFavorites.map((c) => (
                  <ComponentRow
                    key={c.id}
                    component={c}
                    onSelect={handleSelect}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))}
              </Section>
              <Section title="Zuletzt verwendet" empty="Noch nichts verwendet.">
                {filteredRecent.map((c) => (
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
              {filteredResults.map((c) => (
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
              <Text style={styles.createHint}>Neu anlegen als …</Text>
              <Pressable style={styles.createButton} onPress={() => handleCreate('flasche')}>
                <Text style={styles.createButtonText}>+ "{trimmedQuery}" (Flasche)</Text>
              </Pressable>
              <Pressable style={styles.createButton} onPress={() => handleCreate('sonde')}>
                <Text style={styles.createButtonText}>+ "{trimmedQuery}" (Sonde)</Text>
              </Pressable>
              <Pressable style={styles.createButton} onPress={() => handleCreate(null)}>
                <Text style={styles.createButtonText}>+ "{trimmedQuery}" (ohne Angabe)</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
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
        <DeliveryBadge form={component.deliveryForm} />
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
    backgroundColor: '#fff',
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
    color: '#111',
  },
  closeText: {
    color: '#1f6feb',
    fontSize: 15,
  },
  searchInput: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#bbb',
    borderRadius: 10,
    fontSize: 15,
    color: '#111',
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
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  sectionEmpty: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  rowOuter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  rowInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
  },
  rowPressed: {
    backgroundColor: '#f0f4ff',
  },
  rowName: {
    flex: 1,
    fontSize: 15,
    color: '#111',
  },
  starButton: {
    padding: 8,
  },
  star: {
    fontSize: 20,
    color: '#bbb',
  },
  starActive: {
    color: '#f5a623',
  },
  createBox: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    gap: 8,
  },
  createHint: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 4,
  },
  createButton: {
    backgroundColor: '#1f6feb',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
