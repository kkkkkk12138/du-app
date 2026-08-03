import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { Memory } from '../../db/models';
import { fontFamilies } from '../../tokens/typography';
import { formatMemoryTime, parseMemoryTags } from './dailyContext';
import { detailColors, fileSource } from './MemoryDetailParts';
import {
  formatDetailDate,
  formatReplyDate,
  formatReplySign,
  getMemoryDateContext,
} from './memoryDetailLogic';

const moodLabels: Record<string, string> = {
  calm: '平静',
  soft: '柔软',
  warm: '温暖',
  intense: '浓烈',
};

const photoTones: Record<string, string> = {
  dusk: '#B99076',
  spring: '#C8C2A1',
  warm: '#C69A72',
};

function formatDuration(seconds?: number) {
  const rounded = Math.max(0, Math.ceil(seconds ?? 0));
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}

export function MemoryExportCard({
  memory,
  replies,
}: {
  memory: Memory;
  replies: Memory[];
}) {
  const context = getMemoryDateContext(memory.writtenAt);
  const tags = parseMemoryTags(memory.customTags);

  return (
    <View accessibilityLabel="导出内容画布" style={styles.canvas}>
      <View style={styles.paper}>
        <View style={styles.header}>
          <View>
            <Text style={styles.date}>
              {formatDetailDate(memory.writtenAt)}
            </Text>
            <Text style={styles.meta}>
              {formatMemoryTime(memory.writtenAt)}
              {memory.placeDetail ? ` · ${memory.placeDetail}` : ''}
            </Text>
          </View>
          <View style={styles.seal}>
            <Text style={styles.sealText}>{context.seasonChar}</Text>
          </View>
        </View>

        {memory.content ? (
          <Text style={styles.body}>{memory.content}</Text>
        ) : null}

        {memory.imagePath || memory.photoTone ? (
          <View style={styles.photoFrame}>
            {memory.imagePath ? (
              <Image
                resizeMode="cover"
                source={fileSource(memory.imagePath)}
                style={styles.photo}
              />
            ) : (
              <View
                style={[
                  styles.photo,
                  {
                    backgroundColor:
                      photoTones[memory.photoTone ?? ''] ?? '#C8B39D',
                  },
                ]}
              >
                <View style={styles.placeholderSun} />
                <View style={styles.placeholderHorizon} />
              </View>
            )}
            {memory.placeDetail ? (
              <Text style={styles.caption}>{memory.placeDetail}</Text>
            ) : null}
          </View>
        ) : null}

        {memory.audioPath ? (
          <View style={styles.audio}>
            <View style={styles.audioDot} />
            <Text style={styles.audioLabel}>声音记录</Text>
            <View style={styles.audioLine} />
            <Text style={styles.audioTime}>
              {formatDuration(memory.audioDuration)}
            </Text>
          </View>
        ) : null}

        {memory.inkImagePath ? (
          <View style={styles.inkFrame}>
            <Image
              resizeMode="contain"
              source={fileSource(memory.inkImagePath)}
              style={styles.inkImage}
            />
          </View>
        ) : null}

        {tags.length || memory.mood ? (
          <View style={styles.tags}>
            {tags.map(tag => (
              <Text key={tag} style={styles.tag}>
                # {tag}
              </Text>
            ))}
            {memory.mood ? (
              <Text style={styles.mood}>
                心绪 · {moodLabels[memory.mood] ?? memory.mood}
              </Text>
            ) : null}
          </View>
        ) : null}

        {replies.length ? (
          <View style={styles.replies}>
            <Text style={styles.replyEyebrow}>REPLIES THROUGH TIME</Text>
            <Text style={styles.replyTitle}>后来，你这样回信</Text>
            {replies.map(reply => (
              <View key={reply.id} style={styles.reply}>
                <Text style={styles.replyDate}>
                  {formatReplyDate(reply.writtenAt)}
                </Text>
                <Text style={styles.replyBody}>{reply.content}</Text>
                <Text style={styles.replySign}>
                  {formatReplySign(memory.writtenAt, reply.writtenAt)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.footer}>
          <View style={styles.footerLine} />
          <Text style={styles.footerText}>渡 · DU</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    width: 360,
    padding: 18,
    backgroundColor: detailColors.background,
  },
  paper: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    backgroundColor: detailColors.note,
    borderWidth: 0.5,
    borderColor: 'rgba(91,79,68,0.12)',
    borderRadius: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(91,79,68,0.12)',
  },
  date: {
    color: detailColors.ink,
    fontFamily: fontFamilies.serifMedium,
    fontSize: 15,
    lineHeight: 24,
  },
  meta: {
    color: detailColors.inkLight,
    marginTop: 2,
    fontFamily: fontFamilies.serif,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  seal: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(192,112,74,0.6)',
    transform: [{ rotate: '-4deg' }],
  },
  sealText: {
    color: detailColors.accent,
    fontFamily: fontFamilies.serifMedium,
    fontSize: 18,
  },
  body: {
    color: detailColors.ink,
    marginTop: 20,
    fontFamily: fontFamilies.serif,
    fontSize: 16,
    lineHeight: 29,
    letterSpacing: 0.25,
  },
  photoFrame: {
    marginTop: 20,
    padding: 6,
    paddingBottom: 9,
    backgroundColor: '#FFFEFA',
    borderWidth: 0.5,
    borderColor: 'rgba(91,79,68,0.12)',
  },
  photo: {
    width: '100%',
    height: 176,
    overflow: 'hidden',
  },
  placeholderSun: {
    position: 'absolute',
    top: 26,
    right: 28,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,236,196,0.62)',
  },
  placeholderHorizon: {
    position: 'absolute',
    right: 0,
    bottom: 36,
    left: 0,
    height: 44,
    backgroundColor: 'rgba(80,68,65,0.2)',
    transform: [{ skewY: '-5deg' }],
  },
  caption: {
    color: detailColors.inkLight,
    marginTop: 6,
    textAlign: 'center',
    fontFamily: fontFamilies.serif,
    fontSize: 9,
  },
  audio: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
    paddingHorizontal: 12,
    backgroundColor: '#F3EBDD',
  },
  audioDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: detailColors.accent,
  },
  audioLabel: {
    color: detailColors.inkSoft,
    fontFamily: fontFamilies.serif,
    fontSize: 10,
  },
  audioLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: 'rgba(91,79,68,0.18)',
  },
  audioTime: {
    color: detailColors.inkLight,
    fontFamily: fontFamilies.sans,
    fontSize: 9,
  },
  inkFrame: {
    height: 164,
    marginTop: 18,
    padding: 8,
    backgroundColor: '#FCF8EE',
    borderWidth: 0.5,
    borderColor: 'rgba(91,79,68,0.12)',
  },
  inkImage: {
    width: '100%',
    height: '100%',
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(91,79,68,0.1)',
  },
  tag: {
    color: detailColors.inkLight,
    fontFamily: fontFamilies.serif,
    fontSize: 9,
  },
  mood: {
    color: detailColors.accent,
    fontFamily: fontFamilies.serif,
    fontSize: 9,
  },
  replies: {
    marginTop: 24,
    paddingTop: 18,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(192,112,74,0.22)',
  },
  replyEyebrow: {
    color: detailColors.accent,
    fontFamily: fontFamilies.englishSerif,
    fontSize: 9,
    letterSpacing: 1.6,
  },
  replyTitle: {
    color: detailColors.ink,
    marginTop: 2,
    marginBottom: 12,
    fontFamily: fontFamilies.serif,
    fontSize: 14,
  },
  reply: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: detailColors.slip,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(192,112,74,0.35)',
  },
  replyDate: {
    color: detailColors.accent,
    fontFamily: fontFamilies.englishSerif,
    fontSize: 9,
    letterSpacing: 1,
  },
  replyBody: {
    color: detailColors.inkSoft,
    marginTop: 6,
    fontFamily: fontFamilies.serif,
    fontSize: 12,
    lineHeight: 22,
  },
  replySign: {
    color: detailColors.inkLight,
    marginTop: 6,
    textAlign: 'right',
    fontFamily: fontFamilies.serif,
    fontSize: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 20,
  },
  footerLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: 'rgba(91,79,68,0.12)',
  },
  footerText: {
    color: detailColors.inkFaint,
    fontFamily: fontFamilies.englishSerif,
    fontSize: 8,
    letterSpacing: 1.4,
  },
});
