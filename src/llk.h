#pragma once
#define  _CRT_SECURE_NO_WARNINGS
#include<stdio.h>
#include <algorithm>
#include <tchar.h>
#include<stdlib.h>
#include <string.h>
#include <time.h>
#include <conio.h>
#include <Windows.h>
#include <graphics.h>
#include <process.h>
#include <mmsystem.h>

#define MapSize 8 //矩形地图的长  必须为偶数
#define Len_Image 100//正方形图片边长
extern IMAGE img[27];//存储图库
extern char element[];//地图中的元素（字母）
extern int pause_flag;//置为1说明游戏暂停 不计时

LRESULT CALLBACK CBTHookProc(int nCode, WPARAM wParam, LPARAM lParam);
int Msg(HWND hwnd, const char *szText, const char *szCaption, UINT uType);
//判断是否可以消除
int Line(int start[2], int end[2]);//1条线
int TwoLines(int start[2], int end[2]);//2条线
int TreeLines(int start[2], int end[2]);//3条线
//可以消除画路径
int DrawLine(int start[2], int end[2]);//1条线
int DrawTwoLines(int start[2], int end[2]);//2条
int DrawTreeLines(int start[2], int end[2]);//3条

void Oninit_all();//初始化所有数据
void CreateMap();//随机生成地图
void ShowMap();//显示地图
void MoveDir(int Dir);//执行Map数组元素移动
void MoveMap();//移动地图
void Show_time(void *);//显示时间
void Save_game();
void Read_game();

int Modify_XY(double pos);//修正鼠标位置
void Get_Mouse();//获取鼠标事件
void get_kbeve();//获取键盘事件
void delete_or_not(int xt[2], int yt[2]);//执行判断消除操作
int find_step(int x, int y);//找寻下一组解 返回0代表已无解
void Show_helpstep(int kb_key);//提示下一组解
int Find_step_onexit();//判断游戏是否无解
int judge_game();//判断游戏是否结束
void startgame();//开始游戏
void restart_game();//重开游戏
void Openmusic();
void Playmusic();
void DrawStatus();
