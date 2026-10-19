import React from 'react'
import { TouchableOpacity, Text, StyleSheet } from 'react-native'
import { Colors, Shadows } from '../constants/theme'
export function InviteButton({label,onPress,disabled=false,outline=false,testID}:{label:string;onPress:()=>void|Promise<void>;disabled?:boolean;outline?:boolean;testID?:string}) {
 return <TouchableOpacity testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={[inviteStyles.button,outline&&inviteStyles.outline,disabled&&{opacity:0.5}]}><Text style={[inviteStyles.buttonText,outline&&{color:Colors.primaryDark}]}>{label}</Text></TouchableOpacity>
}
export const inviteStyles=StyleSheet.create({
 root:{flex:1,backgroundColor:Colors.background},content:{padding:22,gap:16,paddingBottom:44},
 card:{backgroundColor:Colors.card,padding:20,borderRadius:20,borderWidth:1,borderColor:Colors.border,gap:14,...Shadows.card},
 title:{fontSize:24,fontWeight:'800',color:Colors.textDark},subtitle:{fontSize:17,fontWeight:'700',color:Colors.primaryDark},
 body:{fontSize:14,color:Colors.textSecondary,lineHeight:22},error:{fontSize:14,color:Colors.expense,lineHeight:22},
 button:{minHeight:48,backgroundColor:Colors.primary,borderRadius:14,padding:14,alignItems:'center',justifyContent:'center'},
 outline:{backgroundColor:Colors.surface,borderWidth:1,borderColor:Colors.borderDark},buttonText:{fontSize:15,fontWeight:'700',color:Colors.textOnPrimary},
 input:{minHeight:50,borderWidth:1,borderColor:Colors.borderDark,borderRadius:12,padding:14,fontSize:16,color:Colors.textDark,backgroundColor:Colors.surface},
 row:{flexDirection:'row',gap:12,alignItems:'center'},empty:{padding:20,textAlign:'center',color:Colors.textSecondary},
})
